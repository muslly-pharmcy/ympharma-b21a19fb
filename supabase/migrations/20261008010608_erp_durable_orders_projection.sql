-- Durable local order bridge. Public checkout and production order gates remain disabled.
CREATE TABLE public.erp_bridge_projection(source_id text PRIMARY KEY,epoch text NOT NULL,version bigint NOT NULL,watermark bigint NOT NULL,observed_at timestamptz NOT NULL,payload jsonb NOT NULL);
CREATE TABLE public.erp_bridge_orders(source_id text NOT NULL,order_id text NOT NULL,version bigint NOT NULL,original jsonb NOT NULL,PRIMARY KEY(source_id,order_id));
CREATE TABLE public.erp_bridge_events(seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,source_id text NOT NULL,event_id text UNIQUE NOT NULL,payload jsonb NOT NULL,ack jsonb);
CREATE TABLE public.erp_bridge_projection_requests(source_id text NOT NULL,request_id text NOT NULL,hash text NOT NULL,response jsonb NOT NULL,PRIMARY KEY(source_id,request_id));
ALTER TABLE public.erp_bridge_projection ENABLE ROW LEVEL SECURITY;ALTER TABLE public.erp_bridge_orders ENABLE ROW LEVEL SECURITY;ALTER TABLE public.erp_bridge_events ENABLE ROW LEVEL SECURITY;ALTER TABLE public.erp_bridge_projection_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.erp_bridge_projection,public.erp_bridge_orders,public.erp_bridge_events,public.erp_bridge_projection_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.erp_bridge_projection,public.erp_bridge_orders,public.erp_bridge_events,public.erp_bridge_projection_requests TO service_role;
GRANT USAGE ON SEQUENCE public.erp_bridge_events_seq_seq TO service_role;

CREATE FUNCTION public.erp_bridge_available(p_source text,p_product text) RETURNS numeric LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE snap public.erp_bridge_projection;r jsonb;o record;c jsonb;i jsonb;available numeric;
BEGIN
 SELECT * INTO snap FROM public.erp_bridge_projection WHERE source_id=p_source;
 IF NOT FOUND OR snap.observed_at<clock_timestamp()-interval '60 seconds' OR snap.observed_at>clock_timestamp()+interval '5 seconds' THEN RAISE EXCEPTION 'BRIDGE_SNAPSHOT_STALE';END IF;
 SELECT value INTO r FROM jsonb_array_elements(snap.payload->'rows') WHERE value->>'product_id'=p_product;
 IF r IS NULL THEN RAISE EXCEPTION 'BRIDGE_PRODUCT_UNMAPPED';END IF;available:=(r->>'qty_available_base')::numeric;
 FOR o IN SELECT * FROM public.erp_bridge_orders WHERE source_id=p_source LOOP
  SELECT value INTO c FROM jsonb_array_elements(snap.payload->'coverage') WHERE value->>'order_id'=o.order_id;
  -- Any covered state has already been reflected in authoritative net availability.
  IF c IS NULL THEN
   FOR i IN SELECT value FROM jsonb_array_elements(o.original->'items') WHERE value->>'product_id'=p_product LOOP available:=available-(i->>'quantity')::numeric*(r->>'factor')::numeric;END LOOP;
  END IF;
 END LOOP;
 RETURN greatest(available,0);
END $$;

CREATE FUNCTION public.erp_bridge_ingest_projection(p_source text,p_key text,p_hash text,p_body jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE cfg public.erp_v2_control;old public.erp_bridge_projection;request public.erp_bridge_projection_requests;p jsonb:=p_body->'projection';c jsonb;r jsonb;o public.erp_bridge_orders;e record;answer jsonb;v bigint;w bigint;t timestamptz;prior jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('erp-bridge:'||p_source,0));SELECT * INTO cfg FROM public.erp_v2_control WHERE singleton;
 IF cfg.source_id IS DISTINCT FROM p_source OR p_body->>'sourceSystem' IS DISTINCT FROM p_source OR p_body->>'sourceEpoch' IS DISTINCT FROM cfg.source_epoch THEN RAISE EXCEPTION 'BRIDGE_SOURCE_MISMATCH';END IF;
 SELECT * INTO request FROM public.erp_bridge_projection_requests WHERE source_id=p_source AND request_id=p_key;
 IF FOUND THEN IF request.hash<>p_hash THEN RETURN jsonb_build_object('status',409,'body',jsonb_build_object('error','idempotency_conflict'));END IF;RETURN request.response;END IF;
 IF p_body-'sourceSystem'-'sourceEpoch'-'projection'<>'{}'::jsonb OR p-'version'-'watermark'-'observed_at'-'rows'-'coverage'<>'{}'::jsonb OR coalesce(p->>'version','')!~'^[1-9][0-9]{0,17}$' OR coalesce(p->>'watermark','')!~'^[0-9]{1,18}$' OR jsonb_typeof(p->'rows') IS DISTINCT FROM 'array' OR jsonb_typeof(p->'coverage') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_BRIDGE_PROJECTION';END IF;
 v:=(p->>'version')::bigint;w:=(p->>'watermark')::bigint;t:=(p->>'observed_at')::timestamptz;
 IF t IS NULL OR t<clock_timestamp()-interval '60 seconds' OR t>clock_timestamp()+interval '5 seconds' OR jsonb_array_length(p->'rows') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'BRIDGE_SNAPSHOT_STALE';END IF;
 SELECT * INTO old FROM public.erp_bridge_projection WHERE source_id=p_source;
 IF FOUND AND (v<=old.version OR w<old.watermark OR t<old.observed_at) THEN RAISE EXCEPTION 'BRIDGE_STALE_VERSION';END IF;
 IF (SELECT count(DISTINCT value->>'product_id') FROM jsonb_array_elements(p->'rows'))<>jsonb_array_length(p->'rows') OR (SELECT count(DISTINCT value->>'order_id') FROM jsonb_array_elements(p->'coverage'))<>jsonb_array_length(p->'coverage') THEN RAISE EXCEPTION 'BRIDGE_DUPLICATE_ROWS';END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p->'rows') LOOP
  IF r-'product_id'-'unit_code'-'factor'-'qty_available_base'-'selling_price'-'currency'<>'{}'::jsonb OR coalesce(r->>'qty_available_base','')!~'^[0-9]{1,15}$' OR coalesce(r->>'factor','')!~'^[1-9][0-9]{0,5}$' OR coalesce(r->>'selling_price','')!~'^[0-9]{1,11}\.[0-9]{4}$' OR coalesce(r->>'currency','')!~'^[A-Z]{3}$' OR NOT EXISTS(SELECT 1 FROM public.erp_item_map m WHERE m.source_id=p_source AND m.verified AND m.erp_item_id=r->>'product_id' AND m.unit_code=r->>'unit_code' AND m.units_per_pack=(r->>'factor')::bigint) THEN RAISE EXCEPTION 'BRIDGE_MAPPING_INVALID';END IF;
 END LOOP;
 FOR c IN SELECT value FROM jsonb_array_elements(p->'coverage') LOOP
  SELECT * INTO o FROM public.erp_bridge_orders WHERE source_id=p_source AND order_id=c->>'order_id';
  IF NOT FOUND OR c-'order_id'-'version'-'state'-'sequence'-'items'<>'{}'::jsonb OR c->'items'<>o.original->'items' OR (c->>'version')::bigint>o.version OR (c->>'version')::bigint<1 OR (c->>'sequence')::bigint NOT BETWEEN 1 AND w OR coalesce(c->>'state','') NOT IN ('HELD','CANCELLED','EXPIRED','FULFILLED','REJECTED') THEN RAISE EXCEPTION 'BRIDGE_COVERAGE_INVALID';END IF;
  SELECT value INTO prior FROM jsonb_array_elements(coalesce(old.payload->'coverage','[]')) WHERE value->>'order_id'=c->>'order_id';
  IF prior IS NOT NULL AND (((c->>'sequence')::bigint=(prior->>'sequence')::bigint AND c<>prior) OR (c->>'sequence')::bigint<(prior->>'sequence')::bigint OR (c->>'version')::bigint<(prior->>'version')::bigint OR (prior->>'state'<>'HELD' AND c->>'state'<>prior->>'state')) THEN RAISE EXCEPTION 'BRIDGE_COVERAGE_REGRESSION';END IF;
 END LOOP;
 FOR c IN SELECT value FROM jsonb_array_elements(coalesce(old.payload->'coverage','[]')) LOOP IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'coverage') n WHERE n->>'order_id'=c->>'order_id') THEN RAISE EXCEPTION 'BRIDGE_COVERAGE_LOST';END IF;END LOOP;
 FOR e IN SELECT * FROM public.erp_bridge_events WHERE source_id=p_source AND ack IS NOT NULL AND (ack->>'sequence')::bigint<=w LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'coverage') n WHERE n->>'order_id'=e.payload->>'order_id' AND (n->>'sequence')::bigint>=(e.ack->>'sequence')::bigint) THEN RAISE EXCEPTION 'BRIDGE_ACK_NOT_COVERED';END IF;
 END LOOP;
 INSERT INTO public.erp_bridge_projection VALUES(p_source,cfg.source_epoch,v,w,t,p) ON CONFLICT(source_id) DO UPDATE SET version=excluded.version,watermark=excluded.watermark,observed_at=excluded.observed_at,payload=excluded.payload;
 answer:=jsonb_build_object('status',200,'body',jsonb_build_object('projection_version',v::text,'watermark',w::text,'rows_applied',jsonb_array_length(p->'rows')));
 INSERT INTO public.erp_bridge_projection_requests VALUES(p_source,p_key,p_hash,answer);RETURN answer;
END $$;

CREATE FUNCTION public.erp_bridge_submit(p_source text,p_order text,p_action text,p_version text,p_items jsonb,p_expires timestamptz) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE old public.erp_bridge_orders;snap public.erp_bridge_projection;i jsonb;r jsonb;payload jsonb;event text;v bigint;answer jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('erp-bridge:'||p_source,0));
 IF NOT EXISTS(SELECT 1 FROM public.erp_v2_control WHERE singleton AND source_id=p_source) OR coalesce(p_order,'')!~'^[A-Za-z0-9_-]{1,100}$' OR coalesce(p_version,'')!~'^[1-9][0-9]{0,15}$' OR coalesce(p_action,'') NOT IN ('reserve','cancel','expire') THEN RAISE EXCEPTION 'INVALID_BRIDGE_ORDER';END IF;
 v:=p_version::bigint;event:=p_order||'_'||p_version;
 payload:=jsonb_build_object('event_id',event,'sourceSystem',p_source,'order_id',p_order,'version',p_version,'action',p_action,'items',p_items,'expires_at',p_expires);
 SELECT e.payload INTO answer FROM public.erp_bridge_events e WHERE e.source_id=p_source AND e.event_id=event;
 IF FOUND THEN IF answer<>payload THEN RAISE EXCEPTION 'BRIDGE_ORDER_CONFLICT';END IF;RETURN answer;END IF;
 SELECT * INTO old FROM public.erp_bridge_orders WHERE source_id=p_source AND order_id=p_order;
 IF FOUND THEN
  IF v<>old.version+1 OR p_action='reserve' OR old.original->'items'<>p_items OR (old.original->>'expires_at')::timestamptz<>p_expires THEN RAISE EXCEPTION 'BRIDGE_ORDER_VERSION_CONFLICT';END IF;
  IF p_action='expire' AND p_expires>clock_timestamp() THEN RAISE EXCEPTION 'BRIDGE_NOT_EXPIRED';END IF;
  UPDATE public.erp_bridge_orders SET version=v WHERE source_id=p_source AND order_id=p_order;
 ELSE
  IF v<>1 OR p_action<>'reserve' OR p_expires IS NULL OR p_expires<=clock_timestamp() OR p_expires>clock_timestamp()+interval '15 minutes' OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 OR (SELECT count(DISTINCT value->>'product_id') FROM jsonb_array_elements(p_items))<>jsonb_array_length(p_items) THEN RAISE EXCEPTION 'INVALID_BRIDGE_ORDER';END IF;
  SELECT * INTO snap FROM public.erp_bridge_projection WHERE source_id=p_source;
  FOR i IN SELECT value FROM jsonb_array_elements(p_items) LOOP
   IF jsonb_typeof(i->'quantity') IS DISTINCT FROM 'string' OR jsonb_typeof(i->'unit_price') IS DISTINCT FROM 'string' OR i-'product_id'-'quantity'-'unit_price'-'currency'-'unit_code'-'factor'<>'{}'::jsonb OR coalesce(i->>'quantity','')!~'^[1-9][0-9]{0,5}$' THEN RAISE EXCEPTION 'INVALID_BRIDGE_ITEM';END IF;
   SELECT value INTO r FROM jsonb_array_elements(snap.payload->'rows') WHERE value->>'product_id'=i->>'product_id';
   IF r IS NULL OR r->>'factor' IS DISTINCT FROM i->>'factor' OR r->>'unit_code' IS DISTINCT FROM i->>'unit_code' OR r->>'selling_price' IS DISTINCT FROM i->>'unit_price' OR r->>'currency' IS DISTINCT FROM i->>'currency' THEN RAISE EXCEPTION 'BRIDGE_MAPPING_OR_PRICE_CHANGED';END IF;
   IF public.erp_bridge_available(p_source,i->>'product_id')<(i->>'quantity')::numeric*(r->>'factor')::numeric THEN RAISE EXCEPTION 'INSUFFICIENT_AVAILABLE_STOCK';END IF;
  END LOOP;
  INSERT INTO public.erp_bridge_orders VALUES(p_source,p_order,v,payload);
 END IF;
 INSERT INTO public.erp_bridge_events(source_id,event_id,payload) VALUES(p_source,event,payload);RETURN payload;
END $$;
CREATE FUNCTION public.erp_bridge_pending(p_source text,p_after text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('cursor',seq::text,'event',payload) ORDER BY seq),'[]') FROM (SELECT * FROM public.erp_bridge_events WHERE source_id=p_source AND seq>p_after::bigint ORDER BY seq LIMIT 50) e
$$;
CREATE FUNCTION public.erp_bridge_ack(p_source text,p_event text,p_result jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.erp_bridge_events;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('erp-bridge:'||p_source,0));SELECT * INTO e FROM public.erp_bridge_events WHERE source_id=p_source AND event_id=p_event FOR UPDATE;
 IF NOT FOUND OR p_result-'event_id'-'order_id'-'version'-'state'-'sequence'-'reservation_id'<>'{}'::jsonb OR p_result->>'event_id' IS DISTINCT FROM p_event OR p_result->>'order_id' IS DISTINCT FROM e.payload->>'order_id' OR p_result->>'version' IS DISTINCT FROM e.payload->>'version' OR coalesce(p_result->>'sequence','')!~'^[1-9][0-9]{0,17}$' OR coalesce(p_result->>'state','') NOT IN ('HELD','CANCELLED','EXPIRED','FULFILLED','REJECTED') THEN RAISE EXCEPTION 'BRIDGE_ACK_MISMATCH';END IF;
 IF e.ack IS NOT NULL AND e.ack<>p_result THEN RAISE EXCEPTION 'BRIDGE_ACK_CONFLICT';END IF;
 UPDATE public.erp_bridge_events SET ack=p_result WHERE seq=e.seq;RETURN jsonb_build_object('acked',p_event);
END $$;
REVOKE ALL ON FUNCTION public.erp_bridge_available(text,text),public.erp_bridge_ingest_projection(text,text,text,jsonb),public.erp_bridge_submit(text,text,text,text,jsonb,timestamptz),public.erp_bridge_pending(text,text),public.erp_bridge_ack(text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.erp_bridge_available(text,text),public.erp_bridge_ingest_projection(text,text,text,jsonb),public.erp_bridge_submit(text,text,text,text,jsonb,timestamptz),public.erp_bridge_pending(text,text),public.erp_bridge_ack(text,text,jsonb) TO service_role;
