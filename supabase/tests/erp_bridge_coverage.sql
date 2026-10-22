-- Synthetic regression against the full migrated store schema. All fixtures roll back.
BEGIN;
SET search_path=public,extensions;
INSERT INTO public.erp_v2_control VALUES(true,'ERP95_TEST','EPOCH95');
INSERT INTO public.erp_item_map(erp_item_id,product_id,unit_code,units_per_pack,source_id,verified) VALUES('ITEM95','99999999-9999-4999-8999-999999999999','PIECE',1,'ERP95_TEST',true);
INSERT INTO public.erp_branch_map(erp_branch_id,warehouse_id,source_id,verified) VALUES('BRANCH95','99999999-9999-4999-8999-999999999998','ERP95_TEST',true);
SET LOCAL ROLE service_role;
CREATE FUNCTION pg_temp.projection(v text,w text,q text,c jsonb) RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object('sourceSystem','ERP95_TEST','sourceEpoch','EPOCH95','projection',jsonb_build_object('version',v,'watermark',w,'observed_at',clock_timestamp(),'rows',jsonb_build_array(jsonb_build_object('product_id','ITEM95','unit_code','PIECE','factor','1','qty_available_base',q,'selling_price','10.0000','currency','YER')),'coverage',c))
$$;
CREATE FUNCTION pg_temp.coverage(s text DEFAULT 'HELD',v text DEFAULT '1',seq text DEFAULT '1') RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object('order_id','ORDER95','state',s,'version',v,'sequence',seq,'items','[{"product_id":"ITEM95","quantity":"1","unit_price":"10.0000","currency":"YER","unit_code":"PIECE","factor":"1"}]'::jsonb)
$$;
CREATE FUNCTION pg_temp.ack(s text DEFAULT 'HELD',seq text DEFAULT '1') RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object('event_id','ORDER95_1','order_id','ORDER95','version','1','state',s,'sequence',seq,'reservation_id','99999999-9999-4999-8999-999999999997')
$$;
CREATE FUNCTION pg_temp.rows() RETURNS jsonb LANGUAGE sql AS $$
 SELECT '[{"row_id":"ROW95","erp_item_id":"ITEM95","erp_branch_id":"BRANCH95","source_version":"1","reservation_watermark":"0","qty_available":"1","unit_code":"PIECE","selling_price":"10.0000","currency":"YER"}]'::jsonb
$$;
SELECT public.erp_bridge_ingest_projection('ERP95_TEST','initial95',repeat('a',64),pg_temp.projection('1','0','1','[]'));
SELECT public.erp_bridge_submit('ERP95_TEST','ORDER95','reserve','1',pg_temp.coverage()->'items',clock_timestamp()+interval '10 minutes');
SAVEPOINT base;
DO $test$
DECLARE field text;c jsonb;bad jsonb;denied boolean;n int:=0;
BEGIN
 IF public.erp_bridge_available('ERP95_TEST','ITEM95')<>0 THEN RAISE EXCEPTION 'reserved unit is available';END IF;
 FOREACH field IN ARRAY ARRAY['order_id','version','state','sequence','items'] LOOP
  FOREACH bad IN ARRAY ARRAY[pg_temp.coverage()-field,jsonb_set(pg_temp.coverage(),ARRAY[field],'null')] LOOP
   denied:=false;
   BEGIN PERFORM public.erp_bridge_ingest_projection('ERP95_TEST','invalid95',repeat('b',64),pg_temp.projection('2','1','1',jsonb_build_array(bad)));
   EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'BRIDGE_COVERAGE_INVALID' THEN RAISE;END IF;denied:=true;END;
   IF NOT denied THEN RAISE EXCEPTION 'accepted missing/null %',field;END IF;n:=n+1;
  END LOOP;
 END LOOP;
 FOREACH bad IN ARRAY ARRAY[
  jsonb_set(pg_temp.coverage(),'{version}','1'),jsonb_set(pg_temp.coverage(),'{sequence}','1'),
  jsonb_set(pg_temp.coverage(),'{items}','{}'),jsonb_set(pg_temp.coverage(),'{items}','[]'),
  jsonb_set(pg_temp.coverage(),'{version}','"01"'),jsonb_set(pg_temp.coverage(),'{sequence}','"0"'),
  pg_temp.coverage()||'{"unexpected":true}', '"text"'::jsonb] LOOP
  denied:=false;
  BEGIN PERFORM public.erp_bridge_ingest_projection('ERP95_TEST','invalid95',repeat('b',64),pg_temp.projection('2','1','1',jsonb_build_array(bad)));
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'BRIDGE_COVERAGE_INVALID' THEN RAISE;END IF;denied:=true;END;
  IF NOT denied THEN RAISE EXCEPTION 'accepted malformed coverage %',bad;END IF;n:=n+1;
 END LOOP;
 IF public.erp_bridge_available('ERP95_TEST','ITEM95')<>0 OR (SELECT version FROM public.erp_bridge_projection WHERE source_id='ERP95_TEST')<>1 OR EXISTS(SELECT 1 FROM public.erp_bridge_projection_requests WHERE request_id='invalid95') THEN RAISE EXCEPTION 'invalid projection changed state';END IF;
 RAISE NOTICE 'PASS missing/null/alternate coverage: % denied; held quantity and request state unchanged',n;
END $test$;
ROLLBACK TO base;
DO $test$ DECLARE denied boolean:=false;r jsonb;BEGIN
 PERFORM public.erp_bridge_ack('ERP95_TEST','ORDER95_1',pg_temp.ack());
 BEGIN PERFORM public.erp_bridge_ingest_projection('ERP95_TEST','conflict95',repeat('b',64),pg_temp.projection('2','1','1',jsonb_build_array(pg_temp.coverage('CANCELLED'))));
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'BRIDGE_ACK_COVERAGE_CONFLICT' THEN RAISE;END IF;denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'ack-first mismatch accepted';END IF;
 r:=public.erp_bridge_ingest_projection('ERP95_TEST','accepted95',repeat('b',64),pg_temp.projection('2','1','0',jsonb_build_array(pg_temp.coverage())));
 IF (r->>'status')::int<>200 OR public.erp_bridge_available('ERP95_TEST','ITEM95')<>0 THEN RAISE EXCEPTION 'valid ACK-first changed availability';END IF;
 PERFORM public.erp_bridge_ack('ERP95_TEST','ORDER95_1',pg_temp.ack());
 IF public.erp_bridge_ingest_projection('ERP95_TEST','accepted95',repeat('b',64),pg_temp.projection('2','1','0',jsonb_build_array(pg_temp.coverage())))<>r THEN RAISE EXCEPTION 'replay response changed';END IF;
 IF (public.erp_bridge_ingest_projection('ERP95_TEST','accepted95',repeat('c',64),pg_temp.projection('2','1','0',jsonb_build_array(pg_temp.coverage())))->>'status')::int<>409 THEN RAISE EXCEPTION 'payload conflict accepted';END IF;
 RAISE NOTICE 'PASS ACK-first rejects contradiction; valid projection and replay preserve availability';
END $test$;
ROLLBACK TO base;
DO $test$ DECLARE denied boolean:=false;BEGIN
 PERFORM public.erp_bridge_ingest_projection('ERP95_TEST','accepted95',repeat('b',64),pg_temp.projection('2','1','0',jsonb_build_array(pg_temp.coverage())));
 BEGIN PERFORM public.erp_bridge_ack('ERP95_TEST','ORDER95_1',pg_temp.ack('CANCELLED'));
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'BRIDGE_ACK_COVERAGE_CONFLICT' THEN RAISE;END IF;denied:=true;END;
 IF NOT denied OR EXISTS(SELECT 1 FROM public.erp_bridge_events WHERE source_id='ERP95_TEST' AND ack IS NOT NULL) THEN RAISE EXCEPTION 'snapshot-first contradiction persisted';END IF;
 PERFORM public.erp_bridge_ack('ERP95_TEST','ORDER95_1',pg_temp.ack());
 IF public.erp_bridge_available('ERP95_TEST','ITEM95')<>0 THEN RAISE EXCEPTION 'valid snapshot-first changed availability';END IF;
 RAISE NOTICE 'PASS snapshot-first rejects contradiction; matching late ACK accepted';
END $test$;
ROLLBACK TO base;
DO $test$ DECLARE denied boolean:=false;BEGIN
 PERFORM public.erp_bridge_ack('ERP95_TEST','ORDER95_1',pg_temp.ack('HELD','2'));
 BEGIN PERFORM public.erp_bridge_ingest_projection('ERP95_TEST','future95',repeat('b',64),pg_temp.projection('2','1','1',jsonb_build_array(pg_temp.coverage('CANCELLED'))));
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'BRIDGE_ACK_COVERAGE_CONFLICT' THEN RAISE;END IF;denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'future ACK contradiction accepted';END IF;
 denied:=false;
 BEGIN PERFORM public.erp_bridge_ingest_projection('ERP95_TEST','older-held95',repeat('b',64),pg_temp.projection('2','1','1',jsonb_build_array(pg_temp.coverage())));
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'BRIDGE_ACK_COVERAGE_CONFLICT' THEN RAISE;END IF;denied:=true;END;
 IF NOT denied OR public.erp_bridge_available('ERP95_TEST','ITEM95')<>0 THEN RAISE EXCEPTION 'older HELD coverage released known later hold';END IF;
 PERFORM public.erp_bridge_ingest_projection('ERP95_TEST','future-valid95',repeat('b',64),pg_temp.projection('2','2','0',jsonb_build_array(pg_temp.coverage('HELD','1','2'))));
 RAISE NOTICE 'PASS older same-event coverage denied; exact reservation commit accepted';
END $test$;
ROLLBACK TO base;
DO $test$ DECLARE denied boolean:=false;BEGIN
 PERFORM public.erp_bridge_ingest_projection('ERP95_TEST','snapshot-seq95',repeat('b',64),pg_temp.projection('2','1','0',jsonb_build_array(pg_temp.coverage())));
 BEGIN PERFORM public.erp_bridge_ack('ERP95_TEST','ORDER95_1',pg_temp.ack('HELD','2'));
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'BRIDGE_ACK_COVERAGE_CONFLICT' THEN RAISE;END IF;denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'late ACK with different same-event commit accepted';END IF;
 PERFORM public.erp_bridge_ack('ERP95_TEST','ORDER95_1',pg_temp.ack());
 PERFORM public.erp_bridge_ingest_projection('ERP95_TEST','auto-expiry95',repeat('b',64),pg_temp.projection('3','2','1',jsonb_build_array(pg_temp.coverage('EXPIRED','1','2'))));
 IF public.erp_bridge_available('ERP95_TEST','ITEM95')<>1 THEN RAISE EXCEPTION 'later authoritative auto-expiry blocked';END IF;
 RAISE NOTICE 'PASS late contradictory commit denied; automatic expiry at same order version preserved';
END $test$;
ROLLBACK TO base;
DO $test$ DECLARE denied boolean:=false;exp timestamptz;BEGIN
 SELECT (original->>'expires_at')::timestamptz INTO exp FROM public.erp_bridge_orders WHERE source_id='ERP95_TEST' AND order_id='ORDER95';
 PERFORM public.erp_bridge_submit('ERP95_TEST','ORDER95','cancel','2',pg_temp.coverage()->'items',exp);
 PERFORM public.erp_bridge_ack('ERP95_TEST','ORDER95_1',pg_temp.ack());
 BEGIN PERFORM public.erp_bridge_ingest_projection('ERP95_TEST','version95',repeat('b',64),pg_temp.projection('2','1','0',jsonb_build_array(pg_temp.coverage('HELD','2'))));
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'BRIDGE_ACK_COVERAGE_CONFLICT' THEN RAISE;END IF;denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'same sequence different version accepted';END IF;
 PERFORM public.erp_bridge_ingest_projection('ERP95_TEST','cancel95',repeat('b',64),pg_temp.projection('2','2','1',jsonb_build_array(pg_temp.coverage('CANCELLED','2','2'))));
 PERFORM public.erp_bridge_ack('ERP95_TEST','ORDER95_2',pg_temp.ack('CANCELLED','2')||'{"event_id":"ORDER95_2","version":"2"}');
 IF public.erp_bridge_available('ERP95_TEST','ITEM95')<>1 THEN RAISE EXCEPTION 'authoritative cancellation did not release';END IF;
 RAISE NOTICE 'PASS equal-sequence version conflict denied; versioned cancellation releases exactly one';
END $test$;
ROLLBACK TO base;
DO $test$ DECLARE field text;denied boolean;bad jsonb;n int:=0;BEGIN
 FOREACH field IN ARRAY ARRAY['event_id','order_id','version','state','sequence','reservation_id'] LOOP
  bad:=pg_temp.ack()-field;denied:=false;
  BEGIN PERFORM public.erp_bridge_ack('ERP95_TEST','ORDER95_1',bad);
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'BRIDGE_ACK_MISMATCH' THEN RAISE;END IF;denied:=true;END;
  IF NOT denied THEN RAISE EXCEPTION 'missing ACK field accepted %',field;END IF;n:=n+1;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.erp_bridge_events WHERE source_id='ERP95_TEST' AND ack IS NOT NULL) THEN RAISE EXCEPTION 'invalid ACK mutated event';END IF;
 RAISE NOTICE 'PASS % incomplete ACKs rejected',n;
END $test$;
ROLLBACK TO base;
DO $test$ DECLARE r jsonb;BEGIN
 r:=public.erp_v2_apply_stock('ERP95_TEST','initial95',repeat('a',64),'EPOCH95',pg_temp.rows());
 IF (r->>'status')::int<>409 OR EXISTS(SELECT 1 FROM public.erp_v2_snapshots WHERE source_id='ERP95_TEST') THEN RAISE EXCEPTION 'projection-to-row request collision committed';END IF;
 r:=public.erp_v2_apply_stock('ERP95_TEST','row-first95',repeat('a',64),'EPOCH95',pg_temp.rows());
 IF r#>>'{body,rows,0,status}'<>'APPLIED' THEN RAISE EXCEPTION 'legitimate row stock failed %',r;END IF;
 IF public.erp_v2_apply_stock('ERP95_TEST','row-first95',repeat('a',64),'EPOCH95',pg_temp.rows())<>r THEN RAISE EXCEPTION 'row replay changed';END IF;
 r:=public.erp_bridge_ingest_projection('ERP95_TEST','row-first95',repeat('a',64),pg_temp.projection('2','0','1','[]'));
 IF (r->>'status')::int<>409 OR (SELECT version FROM public.erp_bridge_projection WHERE source_id='ERP95_TEST')<>1 THEN RAISE EXCEPTION 'row-to-projection collision committed';END IF;
 RAISE NOTICE 'PASS both request type collision directions rejected; legitimate row stock and replay accepted';
END $test$;
ROLLBACK TO base;
DO $test$ BEGIN
 IF has_function_privilege('anon','public.erp_bridge_validate_coverage(text,bigint,jsonb)','EXECUTE') OR has_function_privilege('authenticated','public.erp_bridge_assert_ack_coverage(jsonb,jsonb,bigint)','EXECUTE') THEN RAISE EXCEPTION 'helper exposed to public';END IF;
 RAISE NOTICE 'PASS helper ACL remains service-only';
END $test$;
ROLLBACK;
