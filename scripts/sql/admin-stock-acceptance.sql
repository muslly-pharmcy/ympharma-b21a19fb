-- Synthetic database only, after fixtures + actual inv_adjust_stock + migration 0007.
CREATE FUNCTION pg_temp.check_ok(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'ASSERTION FAILED: %',label; END IF; END $$;
DO $$ DECLARE result jsonb; replay jsonb; BEGIN
 PERFORM pg_temp.check_ok(NOT has_function_privilege('anon','public.inv_set_product_stock(uuid,uuid,numeric,numeric,uuid,uuid,text)','EXECUTE'),'anon denied');
 PERFORM pg_temp.check_ok(NOT has_function_privilege('authenticated','public.inv_set_product_stock(uuid,uuid,numeric,numeric,uuid,uuid,text)','EXECUTE'),'direct caller denied');
 PERFORM pg_temp.check_ok(has_function_privilege('service_role','public.inv_set_product_stock(uuid,uuid,numeric,numeric,uuid,uuid,text)','EXECUTE'),'service permitted');
 BEGIN
  PERFORM public.inv_set_product_stock('11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc',15,5,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','12345678-0000-4000-8000-000000000001','count test');
  RAISE EXCEPTION 'reservation rejection missing';
 EXCEPTION WHEN check_violation THEN PERFORM pg_temp.check_ok(SQLERRM='STOCK_RESERVED','reservation error'); END;
 PERFORM pg_temp.check_ok((SELECT sum(qty_on_hand)=15 FROM public.inv_stock_batches),'failed set did not mutate');
 PERFORM pg_temp.check_ok((SELECT count(*)=0 FROM public.inv_stock_set_requests),'failed set has no replay result');
 BEGIN
  PERFORM public.inv_set_product_stock('11111111-1111-4111-8111-111111111111','dddddddd-dddd-4ddd-8ddd-dddddddddddd',0,0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','12345678-0000-4000-8000-000000000002','cross tenant');
  RAISE EXCEPTION 'tenant rejection missing';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.inv_set_product_stock('11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc',15,20,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','12345678-0000-4000-8000-000000000003','ambiguous batch');
  RAISE EXCEPTION 'ambiguous increase rejection missing';
 EXCEPTION WHEN invalid_parameter_value THEN PERFORM pg_temp.check_ok(SQLERRM='RECEIVE_OR_SELECT_BATCH_REQUIRED','batch error'); END;
 -- Fail on the second movement: both stock mutations and movement/event rows must roll back.
 PERFORM set_config('test.fail_batch','00000000-0000-4000-8000-000000000002',true);
 BEGIN
  PERFORM public.inv_set_product_stock('11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc',15,8,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','12345678-0000-4000-8000-000000000004','rollback test');
  RAISE EXCEPTION 'failure injection did not run';
 EXCEPTION WHEN raise_exception THEN PERFORM pg_temp.check_ok(SQLERRM='SYNTHETIC_EVENT_FAILURE','expected injected failure'); END;
 PERFORM pg_temp.check_ok((SELECT sum(qty_on_hand)=15 FROM public.inv_stock_batches),'atomic stock rollback');
 PERFORM pg_temp.check_ok((SELECT count(*)=0 FROM public.inv_stock_movements),'atomic movement rollback');
 PERFORM pg_temp.check_ok((SELECT count(*)=0 FROM public.test_events),'atomic event rollback');
 PERFORM set_config('test.fail_batch','',true);
 result := public.inv_set_product_stock('11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc',15,8,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','12345678-0000-4000-8000-000000000005','valid decrease');
 replay := public.inv_set_product_stock('11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc',15,8,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','12345678-0000-4000-8000-000000000005','valid decrease');
 PERFORM pg_temp.check_ok(result=replay,'same-key replay returns same response');
 PERFORM pg_temp.check_ok((SELECT sum(qty_on_hand)=8 FROM public.inv_stock_batches),'final stock equals 8');
 PERFORM pg_temp.check_ok((SELECT sum(qty_delta)=-7 AND count(*)=2 FROM public.inv_stock_movements),'one movement per changed batch, no replay duplicates');
 BEGIN
  PERFORM public.inv_set_product_stock('11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc',15,9,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','12345678-0000-4000-8000-000000000005','valid decrease');
  RAISE EXCEPTION 'replay conflict missing';
 EXCEPTION WHEN invalid_parameter_value THEN PERFORM pg_temp.check_ok(SQLERRM='IDEMPOTENCY_CONFLICT','payload conflict'); END;
 BEGIN
  PERFORM public.inv_set_product_stock('11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc',15,8,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','12345678-0000-4000-8000-000000000006','stale screen');
  RAISE EXCEPTION 'stale rejection missing';
 EXCEPTION WHEN serialization_failure THEN PERFORM pg_temp.check_ok(SQLERRM='STOCK_BALANCE_CHANGED','stale balance error'); END;
 UPDATE public.organization_members SET branch_scope=ARRAY['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid] WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 BEGIN
  PERFORM public.inv_set_product_stock('11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc',8,8,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','12345678-0000-4000-8000-000000000007','branch limited');
  RAISE EXCEPTION 'branch restriction missing';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT 'PASS: ACL, reservations, tenant/branch isolation, rollback, replay, stale balance' AS acceptance;
