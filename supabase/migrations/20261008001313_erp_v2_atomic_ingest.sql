-- Protocol 2 local review only. Apply AFTER drizzle/migrations/0005_erp_integration_foundation.sql.
-- No source/mapping is activated by this migration; no live orders or website stock are modified.
ALTER TABLE public.erp_item_map ADD COLUMN source_id text, ADD COLUMN verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.erp_branch_map ADD COLUMN source_id text, ADD COLUMN verified boolean NOT NULL DEFAULT false;
CREATE TABLE public.erp_v2_control(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), source_id text NOT NULL, source_epoch text NOT NULL);
CREATE TABLE public.erp_v2_requests(source_id text NOT NULL, request_key text NOT NULL, content_hash text NOT NULL, response jsonb NOT NULL, http_status int NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz, PRIMARY KEY(source_id,request_key));
CREATE TABLE public.erp_v2_rows(source_id text NOT NULL, row_id text NOT NULL, content_hash text NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(source_id,row_id));
CREATE TABLE public.erp_v2_snapshots(source_id text NOT NULL, erp_item_id text NOT NULL, erp_branch_id text NOT NULL, source_epoch text NOT NULL, source_version bigint NOT NULL, reservation_watermark bigint NOT NULL, qty_available_base numeric NOT NULL CHECK(qty_available_base>=0), unit_code text NOT NULL, units_per_pack bigint NOT NULL, selling_price numeric(15,4), official_reference_price numeric(15,4), currency text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(erp_item_id,erp_branch_id));
ALTER TABLE public.erp_v2_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_v2_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_v2_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_v2_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.erp_v2_control,public.erp_v2_requests,public.erp_v2_rows,public.erp_v2_snapshots FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.erp_v2_control TO service_role;
GRANT SELECT,INSERT ON public.erp_v2_requests,public.erp_v2_rows TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.erp_v2_snapshots TO service_role;
-- Retire legacy entry points even for service_role; no unsigned-v1 fallback.
REVOKE ALL ON FUNCTION public.erp_claim_idempotency(text,text,text),public.erp_finish_idempotency(text,jsonb,boolean),public.erp_apply_stock_snapshots(jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.erp_v2_apply_stock(p_source text,p_key text,p_hash text,p_epoch text,p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE owner public.erp_v2_control; req public.erp_v2_requests; oldrow public.erp_v2_rows; current_stock public.erp_v2_snapshots; im public.erp_item_map; bm public.erp_branch_map;
 r jsonb; pos bigint; rid text; rh text; result jsonb; results jsonb:='[]'; response jsonb; code text; ver bigint; wm bigint; qty numeric; factor bigint;
BEGIN
 IF p_source IS NULL OR p_key IS NULL OR p_hash IS NULL OR p_epoch IS NULL OR p_source!~'^[A-Za-z0-9_-]{1,120}$' OR p_key!~'^[A-Za-z0-9_-]{8,200}$' OR p_hash!~'^[a-f0-9]{64}$' THEN RETURN jsonb_build_object('status',400,'body',jsonb_build_object('error','invalid_identity')); END IF;
 SELECT * INTO owner FROM public.erp_v2_control WHERE singleton;
 IF NOT FOUND OR owner.source_id<>p_source OR owner.source_epoch<>p_epoch THEN RETURN jsonb_build_object('status',403,'body',jsonb_build_object('error','source_or_epoch_not_approved')); END IF;
 IF p_rows IS NULL OR jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 500 THEN RETURN jsonb_build_object('status',400,'body',jsonb_build_object('error','invalid_rows')); END IF;
 -- One ordered writer and atomic outcome: crashes roll back both data and request state.
 PERFORM pg_advisory_xact_lock(hashtextextended('erp-v2:'||p_source,0));
 SELECT * INTO req FROM public.erp_v2_requests WHERE source_id=p_source AND request_key=p_key;
 IF FOUND THEN
  IF req.content_hash<>p_hash THEN RETURN jsonb_build_object('status',409,'body',jsonb_build_object('error','idempotency_conflict')); END IF;
  IF req.expires_at IS NOT NULL AND req.expires_at<=now() THEN RETURN jsonb_build_object('status',410,'body',jsonb_build_object('error','request_expired_reconcile_required')); END IF;
  RETURN jsonb_build_object('status',req.http_status,'body',req.response);
 END IF;
 FOR r,pos IN SELECT value,ordinality FROM jsonb_array_elements(p_rows) WITH ORDINALITY LOOP
  rid:=r->>'row_id'; code:=NULL; rh:=encode(sha256(convert_to(r::text,'UTF8')),'hex');
  IF jsonb_typeof(r)<>'object' OR jsonb_typeof(r->'row_id') IS DISTINCT FROM 'string' OR rid!~'^[A-Za-z0-9_-]{1,120}$' THEN
   results:=results||jsonb_build_array(jsonb_build_object('index',pos,'row_id',rid,'status','INVALID','error_code','invalid_row_id','applied_version',NULL)); CONTINUE;
  END IF;
  SELECT * INTO oldrow FROM public.erp_v2_rows WHERE source_id=p_source AND row_id=rid;
  IF FOUND THEN
   IF oldrow.content_hash<>rh THEN result:=jsonb_build_object('row_id',rid,'status','CONFLICT','error_code','row_id_content_conflict','applied_version',NULL);
   ELSE result:=oldrow.result||jsonb_build_object('replayed',true); END IF;
   results:=results||jsonb_build_array(result||jsonb_build_object('index',pos)); CONTINUE;
  END IF;
  IF r-ARRAY['row_id','erp_item_id','erp_branch_id','source_version','reservation_watermark','qty_available','unit_code','selling_price','official_reference_price','currency'] <> '{}'::jsonb THEN code:='unknown_field_or_cost_forbidden';
  ELSIF jsonb_typeof(r->'erp_item_id') IS DISTINCT FROM 'string' OR coalesce(r->>'erp_item_id','')!~'^[A-Za-z0-9_-]{1,120}$' OR jsonb_typeof(r->'erp_branch_id') IS DISTINCT FROM 'string' OR coalesce(r->>'erp_branch_id','')!~'^[A-Za-z0-9_-]{1,120}$' THEN code:='invalid_stock_key';
  ELSIF jsonb_typeof(r->'source_version') IS DISTINCT FROM 'string' OR coalesce(r->>'source_version','')!~'^[1-9][0-9]{0,18}$' OR (r->>'source_version')::numeric>9223372036854775807 THEN code:='invalid_version';
  ELSIF jsonb_typeof(r->'reservation_watermark') IS DISTINCT FROM 'string' OR coalesce(r->>'reservation_watermark','')!~'^(0|[1-9][0-9]{0,18})$' OR (r->>'reservation_watermark')::numeric>9223372036854775807 THEN code:='invalid_watermark';
  ELSIF jsonb_typeof(r->'qty_available') IS DISTINCT FROM 'string' OR coalesce(r->>'qty_available','')!~'^(0|[1-9][0-9]{0,14})(\.[0-9]{1,6})?$' THEN code:='invalid_decimal_quantity';
  ELSIF jsonb_typeof(r->'currency') IS DISTINCT FROM 'string' OR coalesce(r->>'currency','') NOT IN ('YER','SAR','USD') THEN code:='invalid_currency';
  ELSIF jsonb_typeof(r->'unit_code') IS DISTINCT FROM 'string' THEN code:='invalid_unit';
  ELSIF EXISTS(SELECT 1 FROM jsonb_each(r) e WHERE e.key IN('selling_price','official_reference_price') AND e.value<>'null'::jsonb AND (jsonb_typeof(e.value)<>'string' OR trim(both '"' from e.value::text)!~'^(0|[1-9][0-9]{0,10})(\.[0-9]{1,4})?$')) THEN code:='invalid_decimal_price';
  END IF;
  IF code IS NULL THEN
   SELECT * INTO im FROM public.erp_item_map WHERE erp_item_id=r->>'erp_item_id' AND source_id=p_source AND verified AND product_id IS NOT NULL;
   IF NOT FOUND THEN code:='item_mapping_unverified'; END IF;
   SELECT * INTO bm FROM public.erp_branch_map WHERE erp_branch_id=r->>'erp_branch_id' AND source_id=p_source AND verified AND warehouse_id IS NOT NULL;
   IF NOT FOUND THEN code:='branch_not_authorized'; END IF;
   IF code IS NULL AND (im.unit_code<>r->>'unit_code' OR im.units_per_pack<>trunc(im.units_per_pack) OR im.units_per_pack NOT BETWEEN 1 AND 1000000) THEN code:='unit_mapping_mismatch'; END IF;
  END IF;
  result:=NULL;
  IF code IS NULL THEN
   factor:=im.units_per_pack::bigint; qty:=(r->>'qty_available')::numeric*factor; ver:=(r->>'source_version')::bigint; wm:=(r->>'reservation_watermark')::bigint;
   IF qty<>trunc(qty) THEN code:='fractional_base_unit'; ELSE
    SELECT * INTO current_stock FROM public.erp_v2_snapshots WHERE erp_item_id=r->>'erp_item_id' AND erp_branch_id=r->>'erp_branch_id';
    IF FOUND AND (current_stock.source_id<>p_source OR current_stock.source_epoch<>p_epoch) THEN code:='stock_owner_or_epoch_conflict';
    ELSIF FOUND AND (current_stock.source_version>=ver OR current_stock.reservation_watermark>wm) THEN result:=jsonb_build_object('row_id',rid,'status','STALE','error_code','source_revision_or_watermark_not_advanced','applied_version',current_stock.source_version::text);
    ELSE
     INSERT INTO public.erp_v2_snapshots(source_id,erp_item_id,erp_branch_id,source_epoch,source_version,reservation_watermark,qty_available_base,unit_code,units_per_pack,selling_price,official_reference_price,currency)
     VALUES(p_source,r->>'erp_item_id',r->>'erp_branch_id',p_epoch,ver,wm,qty,im.unit_code,factor,(r->>'selling_price')::numeric,(r->>'official_reference_price')::numeric,r->>'currency')
     ON CONFLICT(erp_item_id,erp_branch_id) DO UPDATE SET source_version=excluded.source_version,reservation_watermark=excluded.reservation_watermark,qty_available_base=excluded.qty_available_base,unit_code=excluded.unit_code,units_per_pack=excluded.units_per_pack,selling_price=excluded.selling_price,official_reference_price=excluded.official_reference_price,currency=excluded.currency,applied_at=now();
     result:=jsonb_build_object('row_id',rid,'status','APPLIED','error_code',NULL,'applied_version',ver::text);
    END IF;
   END IF;
  END IF;
  IF code IS NOT NULL THEN result:=jsonb_build_object('row_id',rid,'status','INVALID','error_code',code,'applied_version',NULL); END IF;
  result:=result||jsonb_build_object('content_hash',rh);
  INSERT INTO public.erp_v2_rows VALUES(p_source,rid,rh,result,now());
  results:=results||jsonb_build_array(result||jsonb_build_object('index',pos));
 END LOOP;
 response:=jsonb_build_object('received',jsonb_array_length(p_rows),'rows',results,'staging_only',true,'order_flow_enabled',false);
 INSERT INTO public.erp_v2_requests(source_id,request_key,content_hash,response,http_status) VALUES(p_source,p_key,p_hash,response,200);
 RETURN jsonb_build_object('status',200,'body',response);
END $$;
REVOKE ALL ON FUNCTION public.erp_v2_apply_stock(text,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.erp_v2_apply_stock(text,text,text,text,jsonb) TO service_role;
CREATE FUNCTION public.erp_v2_reconcile(p_source text,p_item text,p_branch text,p_limit integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) FROM (
 SELECT s.erp_item_id,s.erp_branch_id,s.source_epoch,s.source_version::text,s.reservation_watermark::text,s.qty_available_base::text,s.unit_code,s.units_per_pack::text,s.selling_price::text,s.official_reference_price::text,s.currency
 FROM public.erp_v2_snapshots s JOIN public.erp_v2_control c ON c.source_id=s.source_id AND c.source_epoch=s.source_epoch
 JOIN public.erp_item_map i ON i.erp_item_id=s.erp_item_id AND i.source_id=s.source_id AND i.verified
 JOIN public.erp_branch_map b ON b.erp_branch_id=s.erp_branch_id AND b.source_id=s.source_id AND b.verified
 WHERE s.source_id=p_source AND (s.erp_item_id COLLATE "C",s.erp_branch_id COLLATE "C")>(p_item COLLATE "C",p_branch COLLATE "C") AND p_limit BETWEEN 1 AND 100
 ORDER BY s.erp_item_id COLLATE "C",s.erp_branch_id COLLATE "C" LIMIT least(greatest(p_limit,1),100)+1
 ) x;
$$;
REVOKE ALL ON FUNCTION public.erp_v2_reconcile(text,text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.erp_v2_reconcile(text,text,text,integer) TO service_role;
