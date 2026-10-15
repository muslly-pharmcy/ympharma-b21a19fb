-- Forward correction: keep original retained migrations byte-preserved.
CREATE OR REPLACE FUNCTION public.erp_bridge_validate_coverage(p_source text,p_watermark bigint,p_coverage jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c jsonb; o public.erp_bridge_orders;
BEGIN
 IF jsonb_typeof(p_coverage) IS DISTINCT FROM 'array' OR p_watermark IS NULL OR p_watermark<0 THEN RAISE EXCEPTION 'BRIDGE_COVERAGE_INVALID';END IF;
 FOR c IN SELECT value FROM jsonb_array_elements(p_coverage) LOOP
  IF jsonb_typeof(c) IS DISTINCT FROM 'object'
   OR NOT(c ?& ARRAY['order_id','version','state','sequence','items'])
   OR c-ARRAY['order_id','version','state','sequence','items']<>'{}'::jsonb
   OR jsonb_typeof(c->'order_id') IS DISTINCT FROM 'string'
   OR jsonb_typeof(c->'version') IS DISTINCT FROM 'string'
   OR jsonb_typeof(c->'sequence') IS DISTINCT FROM 'string'
   OR jsonb_typeof(c->'items') IS DISTINCT FROM 'array'
   OR coalesce(c->>'version','')!~'^[1-9][0-9]{0,15}$'
   OR coalesce(c->>'sequence','')!~'^[1-9][0-9]{0,17}$'
   OR coalesce(c->>'state','') NOT IN ('HELD','CANCELLED','EXPIRED','FULFILLED','REJECTED')
  THEN RAISE EXCEPTION 'BRIDGE_COVERAGE_INVALID';END IF;
  SELECT * INTO o FROM public.erp_bridge_orders WHERE source_id=p_source AND order_id=c->>'order_id';
  IF NOT FOUND OR c->'items' IS DISTINCT FROM o.original->'items'
    OR (c->>'version')::bigint>o.version OR (c->>'sequence')::bigint>p_watermark
  THEN RAISE EXCEPTION 'BRIDGE_COVERAGE_INVALID';END IF;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.erp_bridge_assert_ack_coverage(p_coverage jsonb,p_ack jsonb,p_watermark bigint)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE seq bigint; version bigint;
BEGIN
 IF jsonb_typeof(p_ack) IS DISTINCT FROM 'object'
  OR NOT(p_ack ?& ARRAY['event_id','order_id','version','state','sequence','reservation_id'])
  OR jsonb_typeof(p_ack->'event_id') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_ack->'order_id') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_ack->'version') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_ack->'sequence') IS DISTINCT FROM 'string'
  OR coalesce(p_ack->>'version','')!~'^[1-9][0-9]{0,15}$'
  OR coalesce(p_ack->>'sequence','')!~'^[1-9][0-9]{0,17}$'
  OR coalesce(p_ack->>'state','') NOT IN ('HELD','CANCELLED','EXPIRED','FULFILLED','REJECTED')
  THEN RAISE EXCEPTION 'BRIDGE_ACK_MISMATCH';END IF;
 seq:=(p_ack->>'sequence')::bigint;version:=(p_ack->>'version')::bigint;
 IF seq<=p_watermark AND (p_coverage IS NULL OR (p_coverage->>'sequence')::bigint<seq) THEN RAISE EXCEPTION 'BRIDGE_ACK_NOT_COVERED';END IF;
 IF p_coverage IS NOT NULL THEN
  -- A single event version has one immutable ACK commit. Only a later lifecycle state
  -- (for example automatic expiry after HELD) can advance coverage at that version.
  IF (p_coverage->>'version')::bigint=version AND (p_coverage->>'sequence')::bigint<>seq AND
     ((p_coverage->>'sequence')::bigint<seq OR p_coverage->>'state'=p_ack->>'state') THEN RAISE EXCEPTION 'BRIDGE_ACK_COVERAGE_CONFLICT';END IF;
  IF (p_coverage->>'sequence')::bigint=seq AND
     (p_coverage->>'version' IS DISTINCT FROM p_ack->>'version' OR p_coverage->>'state' IS DISTINCT FROM p_ack->>'state') THEN RAISE EXCEPTION 'BRIDGE_ACK_COVERAGE_CONFLICT';END IF;
  IF (p_coverage->>'sequence')::bigint>seq AND
     ((p_coverage->>'version')::bigint<version OR (p_ack->>'state'<>'HELD' AND p_coverage->>'state' IS DISTINCT FROM p_ack->>'state')) THEN RAISE EXCEPTION 'BRIDGE_ACK_COVERAGE_CONFLICT';END IF;
  IF (p_coverage->>'sequence')::bigint<seq AND
     ((p_coverage->>'version')::bigint>version OR (p_coverage->>'state'<>'HELD' AND p_coverage->>'state' IS DISTINCT FROM p_ack->>'state')) THEN RAISE EXCEPTION 'BRIDGE_ACK_COVERAGE_CONFLICT';END IF;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.erp_bridge_validate_coverage(text,bigint,jsonb),public.erp_bridge_assert_ack_coverage(jsonb,jsonb,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.erp_bridge_validate_coverage(text,bigint,jsonb),public.erp_bridge_assert_ack_coverage(jsonb,jsonb,bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.erp_v2_apply_stock(p_source text,p_key text,p_hash text,p_epoch text,p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE owner public.erp_v2_control; req public.erp_v2_requests; oldrow public.erp_v2_rows; current_stock public.erp_v2_snapshots; im public.erp_item_map; bm public.erp_branch_map;
 r jsonb; pos bigint; rid text; rh text; result jsonb; results jsonb:='[]'; response jsonb; code text; ver bigint; wm bigint; qty numeric; factor bigint;
BEGIN
 IF p_source IS NULL OR p_key IS NULL OR p_hash IS NULL OR p_epoch IS NULL OR p_source!~'^[A-Za-z0-9_-]{1,120}$' OR p_key!~'^[A-Za-z0-9_-]{8,200}$' OR p_hash!~'^[a-f0-9]{64}$' THEN RETURN jsonb_build_object('status',400,'body',jsonb_build_object('error','invalid_identity')); END IF;
 SELECT * INTO owner FROM public.erp_v2_control WHERE singleton;
 IF NOT FOUND OR owner.source_id<>p_source OR owner.source_epoch<>p_epoch THEN RETURN jsonb_build_object('status',403,'body',jsonb_build_object('error','source_or_epoch_not_approved')); END IF;
 IF p_rows IS NULL OR jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 500 THEN RETURN jsonb_build_object('status',400,'body',jsonb_build_object('error','invalid_rows')); END IF;
 -- One ordered writer and atomic outcome: crashes roll back both data and request state.
 PERFORM pg_advisory_xact_lock(hashtextextended('erp-stock-endpoint:'||p_source,0));
 IF EXISTS(SELECT 1 FROM public.erp_bridge_projection_requests WHERE source_id=p_source AND request_id=p_key) THEN RETURN jsonb_build_object('status',409,'body',jsonb_build_object('error','idempotency_conflict'));END IF;
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
CREATE OR REPLACE FUNCTION public.erp_bridge_ingest_projection(p_source text,p_key text,p_hash text,p_body jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE cfg public.erp_v2_control;old public.erp_bridge_projection;request public.erp_bridge_projection_requests;p jsonb:=p_body->'projection';c jsonb;r jsonb;o public.erp_bridge_orders;e record;answer jsonb;v bigint;w bigint;t timestamptz;prior jsonb;
BEGIN
 IF p_source IS NULL OR p_key IS NULL OR p_hash IS NULL OR p_source!~'^[A-Za-z0-9_-]{1,120}$' OR p_key!~'^[A-Za-z0-9_-]{8,200}$' OR p_hash!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'INVALID_BRIDGE_IDENTITY';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('erp-stock-endpoint:'||p_source,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('erp-bridge:'||p_source,0));SELECT * INTO cfg FROM public.erp_v2_control WHERE singleton;
 IF cfg.source_id IS DISTINCT FROM p_source OR p_body->>'sourceSystem' IS DISTINCT FROM p_source OR p_body->>'sourceEpoch' IS DISTINCT FROM cfg.source_epoch THEN RAISE EXCEPTION 'BRIDGE_SOURCE_MISMATCH';END IF;
 IF EXISTS(SELECT 1 FROM public.erp_v2_requests WHERE source_id=p_source AND request_key=p_key) THEN RETURN jsonb_build_object('status',409,'body',jsonb_build_object('error','idempotency_conflict'));END IF;
 SELECT * INTO request FROM public.erp_bridge_projection_requests WHERE source_id=p_source AND request_id=p_key;
 IF FOUND THEN IF request.hash<>p_hash THEN RETURN jsonb_build_object('status',409,'body',jsonb_build_object('error','idempotency_conflict'));END IF;RETURN request.response;END IF;
 IF p_body-'sourceSystem'-'sourceEpoch'-'projection'<>'{}'::jsonb OR p-'version'-'watermark'-'observed_at'-'rows'-'coverage'<>'{}'::jsonb OR coalesce(p->>'version','')!~'^[1-9][0-9]{0,17}$' OR coalesce(p->>'watermark','')!~'^[0-9]{1,18}$' OR jsonb_typeof(p->'rows') IS DISTINCT FROM 'array' OR jsonb_typeof(p->'coverage') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_BRIDGE_PROJECTION';END IF;
 v:=(p->>'version')::bigint;w:=(p->>'watermark')::bigint;t:=(p->>'observed_at')::timestamptz;
 IF t IS NULL OR t<clock_timestamp()-interval '60 seconds' OR t>clock_timestamp()+interval '5 seconds' OR jsonb_array_length(p->'rows') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'BRIDGE_SNAPSHOT_STALE';END IF;
 PERFORM public.erp_bridge_validate_coverage(p_source,w,p->'coverage');
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
 FOR e IN SELECT * FROM public.erp_bridge_events WHERE source_id=p_source AND ack IS NOT NULL LOOP
  SELECT value INTO c FROM jsonb_array_elements(p->'coverage') WHERE value->>'order_id'=e.payload->>'order_id';
  PERFORM public.erp_bridge_assert_ack_coverage(c,e.ack,w);
 END LOOP;
 INSERT INTO public.erp_bridge_projection VALUES(p_source,cfg.source_epoch,v,w,t,p) ON CONFLICT(source_id) DO UPDATE SET version=excluded.version,watermark=excluded.watermark,observed_at=excluded.observed_at,payload=excluded.payload;
 answer:=jsonb_build_object('status',200,'body',jsonb_build_object('projection_version',v::text,'watermark',w::text,'rows_applied',jsonb_array_length(p->'rows')));
 INSERT INTO public.erp_bridge_projection_requests VALUES(p_source,p_key,p_hash,answer);RETURN answer;
END $$;
CREATE OR REPLACE FUNCTION public.erp_bridge_ack(p_source text,p_event text,p_result jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.erp_bridge_events; snap public.erp_bridge_projection; coverage jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('erp-bridge:'||p_source,0));SELECT * INTO e FROM public.erp_bridge_events WHERE source_id=p_source AND event_id=p_event FOR UPDATE;
 IF NOT FOUND OR p_result-'event_id'-'order_id'-'version'-'state'-'sequence'-'reservation_id'<>'{}'::jsonb OR p_result->>'event_id' IS DISTINCT FROM p_event OR p_result->>'order_id' IS DISTINCT FROM e.payload->>'order_id' OR p_result->>'version' IS DISTINCT FROM e.payload->>'version' OR coalesce(p_result->>'sequence','')!~'^[1-9][0-9]{0,17}$' OR coalesce(p_result->>'state','') NOT IN ('HELD','CANCELLED','EXPIRED','FULFILLED','REJECTED') THEN RAISE EXCEPTION 'BRIDGE_ACK_MISMATCH';END IF;
 SELECT * INTO snap FROM public.erp_bridge_projection WHERE source_id=p_source;
 SELECT value INTO coverage FROM jsonb_array_elements(coalesce(snap.payload->'coverage','[]')) WHERE value->>'order_id'=e.payload->>'order_id';
 PERFORM public.erp_bridge_assert_ack_coverage(coverage,p_result,coalesce(snap.watermark,0));
 IF e.ack IS NOT NULL AND e.ack<>p_result THEN RAISE EXCEPTION 'BRIDGE_ACK_CONFLICT';END IF;
 UPDATE public.erp_bridge_events SET ack=p_result WHERE seq=e.seq;RETURN jsonb_build_object('acked',p_event);
END $$;

-- Reject unsafe existing persisted state; never silently normalize it during upgrade.
DO $check$ DECLARE p record;e record;c jsonb;
BEGIN
 FOR p IN SELECT * FROM public.erp_bridge_projection LOOP
  PERFORM public.erp_bridge_validate_coverage(p.source_id,p.watermark,p.payload->'coverage');
  FOR e IN SELECT * FROM public.erp_bridge_events WHERE source_id=p.source_id AND ack IS NOT NULL LOOP
   SELECT value INTO c FROM jsonb_array_elements(p.payload->'coverage') WHERE value->>'order_id'=e.payload->>'order_id';
   PERFORM public.erp_bridge_assert_ack_coverage(c,e.ack,p.watermark);
  END LOOP;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.erp_v2_requests r JOIN public.erp_bridge_projection_requests pr ON pr.source_id=r.source_id AND pr.request_id=r.request_key) THEN RAISE EXCEPTION 'STOCK_ENDPOINT_DUPLICATE_REQUEST_REQUIRES_RECONCILIATION';END IF;
END $check$;
