-- Review checkout only. Existing installations remain legacy until an explicit local/staging switch.
CREATE SCHEMA erp_checkout_private;
REVOKE ALL ON SCHEMA erp_checkout_private FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA erp_checkout_private TO authenticated;
CREATE TABLE erp_checkout_private.control(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),mode text NOT NULL CHECK(mode IN ('legacy','erp','paused')),source_id text);
INSERT INTO erp_checkout_private.control VALUES(true,'legacy',NULL);
CREATE TABLE erp_checkout_private.requests(user_id uuid NOT NULL,request_id uuid NOT NULL,source_id text NOT NULL,order_id text NOT NULL UNIQUE,quote_hash text NOT NULL,quote jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,request_id));
ALTER TABLE erp_checkout_private.control ENABLE ROW LEVEL SECURITY;ALTER TABLE erp_checkout_private.requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON erp_checkout_private.control,erp_checkout_private.requests FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION erp_checkout_private.guard_mode() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.mode='erp' AND NOT EXISTS(SELECT 1 FROM public.erp_v2_control WHERE singleton AND source_id=NEW.source_id) THEN RAISE EXCEPTION 'ERP_SOURCE_NOT_APPROVED';END IF;
 IF OLD.source_id IS NOT NULL AND (NEW.mode='legacy' OR NEW.source_id IS DISTINCT FROM OLD.source_id) AND EXISTS(
 SELECT 1 FROM public.erp_bridge_orders o LEFT JOIN public.erp_bridge_projection p ON p.source_id=o.source_id
 WHERE o.source_id=OLD.source_id AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(p.payload->'coverage','[]')) c WHERE c->>'order_id'=o.order_id AND (c->>'version')::bigint>=o.version AND c->>'state' IN ('CANCELLED','EXPIRED','FULFILLED','REJECTED')))
 THEN RAISE EXCEPTION 'ERP_ORDERS_REQUIRE_RECONCILIATION';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER erp_checkout_mode_guard BEFORE UPDATE ON erp_checkout_private.control FOR EACH ROW EXECUTE FUNCTION erp_checkout_private.guard_mode();

CREATE FUNCTION erp_checkout_private.cart_lock() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.user_id<>OLD.user_id THEN RAISE EXCEPTION 'CART_OWNER_IMMUTABLE';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('erp-cart:'||coalesce(NEW.user_id,OLD.user_id)::text,0));
 RETURN coalesce(NEW,OLD);
END $$;
CREATE TRIGGER erp_checkout_cart_lock BEFORE INSERT OR UPDATE OR DELETE ON public.cart_items FOR EACH ROW EXECUTE FUNCTION erp_checkout_private.cart_lock();

-- Acquire the cart advisory lock before any row locks, matching quote/submit.
CREATE FUNCTION erp_checkout_private.cart_statement_lock() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('erp-cart:'||auth.uid()::text,0));END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER erp_checkout_cart_statement_lock BEFORE INSERT OR UPDATE OR DELETE ON public.cart_items FOR EACH STATEMENT EXECUTE FUNCTION erp_checkout_private.cart_statement_lock();

CREATE FUNCTION erp_checkout_private.mode() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c erp_checkout_private.control;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT * INTO STRICT c FROM erp_checkout_private.control WHERE singleton;
 RETURN jsonb_build_object('mode',c.mode,'actor_id',auth.uid(),'review_only',c.mode='erp');
END $$;
CREATE FUNCTION erp_checkout_private.quote() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();c erp_checkout_private.control;p public.erp_bridge_projection;item record;r jsonb;lines jsonb:='[]';items jsonb:='[]';currency text;subtotal numeric:=0;digest text;available numeric;line_total numeric;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT * INTO STRICT c FROM erp_checkout_private.control WHERE singleton FOR SHARE;
 IF c.mode<>'erp' THEN RAISE EXCEPTION 'ERP_CHECKOUT_DISABLED';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('erp-cart:'||actor::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('erp-bridge:'||c.source_id,0));
 SELECT * INTO p FROM public.erp_bridge_projection WHERE source_id=c.source_id;
 IF NOT FOUND OR p.observed_at<clock_timestamp()-interval '60 seconds' THEN RAISE EXCEPTION 'ERP_SNAPSHOT_STALE';END IF;
 IF (SELECT count(*) FROM public.cart_items WHERE user_id=actor) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'CART_EMPTY_OR_TOO_LARGE';END IF;
 FOR item IN SELECT ci.product_id,ci.quantity,cp.name_ar,cp.requires_prescription,cp.status,cp.is_public FROM public.cart_items ci JOIN public.catalog_products cp ON cp.id=ci.product_id WHERE ci.user_id=actor ORDER BY ci.product_id FOR UPDATE OF ci LOOP
  IF item.requires_prescription OR NOT item.is_public OR item.status::text NOT IN ('active','approved') OR item.quantity NOT BETWEEN 1 AND 99 THEN RAISE EXCEPTION 'PRODUCT_NOT_REVIEWABLE';END IF;
  IF (SELECT count(*) FROM public.erp_item_map WHERE source_id=c.source_id AND verified AND product_id=item.product_id)<>1 THEN RAISE EXCEPTION 'PRODUCT_MAPPING_REVIEW_REQUIRED';END IF;
  SELECT value INTO r FROM jsonb_array_elements(p.payload->'rows') WHERE value->>'product_id'=(SELECT erp_item_id FROM public.erp_item_map WHERE source_id=c.source_id AND verified AND product_id=item.product_id);
  IF r IS NULL THEN RAISE EXCEPTION 'PRODUCT_MAPPING_REVIEW_REQUIRED';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.erp_item_map WHERE source_id=c.source_id AND verified AND product_id=item.product_id AND unit_code=r->>'unit_code' AND units_per_pack=(r->>'factor')::numeric) THEN RAISE EXCEPTION 'PRODUCT_MAPPING_REVIEW_REQUIRED';END IF;
  available:=public.erp_bridge_available(c.source_id,r->>'product_id');
  IF available<item.quantity*(r->>'factor')::numeric THEN RAISE EXCEPTION 'INSUFFICIENT_AVAILABLE_STOCK';END IF;
  IF currency IS NOT NULL AND currency<>r->>'currency' THEN RAISE EXCEPTION 'MIXED_CURRENCY';END IF;currency:=r->>'currency';
  line_total:=item.quantity*(r->>'selling_price')::numeric;subtotal:=subtotal+line_total;
  items:=items||jsonb_build_array(jsonb_build_object('product_id',r->>'product_id','quantity',item.quantity::text,'unit_price',r->>'selling_price','currency',currency,'unit_code',r->>'unit_code','factor',r->>'factor'));
  lines:=lines||jsonb_build_array(jsonb_build_object('product_id',item.product_id,'name',item.name_ar,'quantity',item.quantity::text,'unit',r->>'unit_code','unit_price',r->>'selling_price','line_total',line_total::numeric(15,4)::text));
 END LOOP;
 IF jsonb_array_length(lines)=0 THEN RAISE EXCEPTION 'CART_EMPTY';END IF;
 digest:=encode(sha256(convert_to(jsonb_build_object('source',c.source_id,'epoch',p.epoch,'items',items,'lines',lines)::text,'UTF8')),'hex');
 RETURN jsonb_build_object('hash',digest,'source',c.source_id,'items',items,'lines',lines,'currency',currency,'subtotal',subtotal::numeric(15,4)::text,'snapshot_version',p.version::text,'review_only',true,'shipping_included',false,'payment_collected',false);
END $$;
CREATE FUNCTION erp_checkout_private.status(p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();q erp_checkout_private.requests;o public.erp_bridge_orders;s public.erp_bridge_projection;coverage jsonb;ack jsonb;state text:='PENDING_REVIEW';confirmed boolean:=false;deadline timestamptz;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT * INTO q FROM erp_checkout_private.requests WHERE user_id=actor AND request_id=p_request;
 IF NOT FOUND THEN RAISE EXCEPTION 'REVIEW_ORDER_NOT_FOUND';END IF;
 SELECT * INTO STRICT o FROM public.erp_bridge_orders WHERE source_id=q.source_id AND order_id=q.order_id;deadline:=(o.original->>'expires_at')::timestamptz;
 SELECT * INTO s FROM public.erp_bridge_projection WHERE source_id=q.source_id;
 SELECT value INTO coverage FROM jsonb_array_elements(coalesce(s.payload->'coverage','[]')) WHERE value->>'order_id'=q.order_id;
 SELECT e.ack INTO ack FROM public.erp_bridge_events e WHERE e.source_id=q.source_id AND e.payload->>'order_id'=q.order_id AND e.payload->>'version'=o.version::text;
 IF coverage IS NOT NULL AND (coverage->>'version')::bigint>=o.version THEN state:=coverage->>'state';confirmed:=true;
 ELSIF ack IS NOT NULL THEN state:=ack->>'state';
 ELSIF o.version>1 THEN state:='CANCEL_PENDING';END IF;
 IF state IN ('PENDING_REVIEW','HELD') AND deadline<=clock_timestamp() THEN state:='EXPIRY_PENDING';confirmed:=false;END IF;
 RETURN jsonb_build_object('request_id',q.request_id,'order_id',q.order_id,'version',o.version::text,'state',state,'coverage_confirmed',confirmed,'sequence',CASE WHEN confirmed THEN coverage->>'sequence' ELSE ack->>'sequence' END,'expires_at',deadline,'server_time',clock_timestamp(),'confirmation_delayed',state IN ('PENDING_REVIEW','CANCEL_PENDING','EXPIRY_PENDING') AND q.created_at<clock_timestamp()-interval '30 seconds','quote',q.quote,'review_only',true,'payment_collected',false);
END $$;
CREATE FUNCTION erp_checkout_private.submit(p_request uuid,p_quote_hash text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();c erp_checkout_private.control;old erp_checkout_private.requests;q jsonb;order_id text;
BEGIN
 IF actor IS NULL OR p_request IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT * INTO STRICT c FROM erp_checkout_private.control WHERE singleton FOR SHARE;
 PERFORM pg_advisory_xact_lock(hashtextextended('erp-cart:'||actor::text,0));
 SELECT * INTO old FROM erp_checkout_private.requests WHERE user_id=actor AND request_id=p_request;
 IF FOUND THEN IF old.quote_hash IS DISTINCT FROM p_quote_hash THEN RAISE EXCEPTION 'CHECKOUT_REQUEST_CONFLICT';END IF;RETURN erp_checkout_private.status(p_request);END IF;
 IF c.mode<>'erp' THEN RAISE EXCEPTION 'ERP_CHECKOUT_DISABLED';END IF;
 q:=erp_checkout_private.quote();IF q->>'hash' IS DISTINCT FROM p_quote_hash THEN RAISE EXCEPTION 'CART_OR_PRICE_CHANGED_REQUOTE';END IF;
 order_id:='WEB_'||replace(actor::text,'-','')||'_'||replace(p_request::text,'-','');
 PERFORM public.erp_bridge_submit(c.source_id,order_id,'reserve','1',q->'items',clock_timestamp()+interval '10 minutes');
 INSERT INTO erp_checkout_private.requests VALUES(actor,p_request,c.source_id,order_id,p_quote_hash,q,clock_timestamp());
 DELETE FROM public.cart_items WHERE user_id=actor;
 RETURN erp_checkout_private.status(p_request);
END $$;
CREATE FUNCTION erp_checkout_private.cancel(p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();q erp_checkout_private.requests;o public.erp_bridge_orders;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT * INTO q FROM erp_checkout_private.requests WHERE user_id=actor AND request_id=p_request;
 IF NOT FOUND THEN RAISE EXCEPTION 'REVIEW_ORDER_NOT_FOUND';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('erp-bridge:'||q.source_id,0));
 SELECT * INTO STRICT o FROM public.erp_bridge_orders WHERE source_id=q.source_id AND order_id=q.order_id;
 IF o.version=1 THEN PERFORM public.erp_bridge_submit(q.source_id,q.order_id,'cancel','2',o.original->'items',(o.original->>'expires_at')::timestamptz);END IF;
 RETURN erp_checkout_private.status(p_request);
END $$;

-- The old function cannot be called directly after this migration.
ALTER FUNCTION public.checkout_cart_fefo(text,text,text,uuid,text,text) RENAME TO checkout_cart_fefo_legacy;
REVOKE ALL ON FUNCTION public.checkout_cart_fefo_legacy(text,text,text,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.checkout_cart_fefo(p_customer_name text,p_customer_phone text,p_customer_address text,p_shipping_zone_id uuid,p_payment_method_code text,p_notes text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE mode text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT c.mode INTO STRICT mode FROM erp_checkout_private.control c WHERE singleton FOR SHARE;
 IF mode<>'legacy' THEN RAISE EXCEPTION 'ERP_MANAGED_CHECKOUT_REQUIRED';END IF;
 RETURN public.checkout_cart_fefo_legacy(p_customer_name,p_customer_phone,p_customer_address,p_shipping_zone_id,p_payment_method_code,p_notes);
END $$;
CREATE FUNCTION public.erp_checkout_mode() RETURNS jsonb LANGUAGE sql SET search_path='' AS $$ SELECT erp_checkout_private.mode() $$;
CREATE FUNCTION public.erp_checkout_quote() RETURNS jsonb LANGUAGE sql SET search_path='' AS $$ SELECT erp_checkout_private.quote() $$;
CREATE FUNCTION public.erp_checkout_submit(p_request uuid,p_quote_hash text) RETURNS jsonb LANGUAGE sql SET search_path='' AS $$ SELECT erp_checkout_private.submit(p_request,p_quote_hash) $$;
CREATE FUNCTION public.erp_checkout_status(p_request uuid) RETURNS jsonb LANGUAGE sql SET search_path='' AS $$ SELECT erp_checkout_private.status(p_request) $$;
CREATE FUNCTION public.erp_checkout_cancel(p_request uuid) RETURNS jsonb LANGUAGE sql SET search_path='' AS $$ SELECT erp_checkout_private.cancel(p_request) $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA erp_checkout_private FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION erp_checkout_private.mode(),erp_checkout_private.quote(),erp_checkout_private.submit(uuid,text),erp_checkout_private.status(uuid),erp_checkout_private.cancel(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.erp_checkout_mode(),public.erp_checkout_quote(),public.erp_checkout_submit(uuid,text),public.erp_checkout_status(uuid),public.erp_checkout_cancel(uuid),public.checkout_cart_fefo(text,text,text,uuid,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.erp_checkout_mode(),public.erp_checkout_quote(),public.erp_checkout_submit(uuid,text),public.erp_checkout_status(uuid),public.erp_checkout_cancel(uuid),public.checkout_cart_fefo(text,text,text,uuid,text,text) TO authenticated;
