-- Disposable staging acceptance only. All assertions fail CI if violated.
SET client_min_messages TO warning;

INSERT INTO public.erp2_item_map(org_id,external_item,product_id,unit_code,units_per_pack)
VALUES
 ('11111111-1111-4111-8111-111111111111','SAME-SKU','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','BOX',10),
 ('22222222-2222-4222-8222-222222222222','SAME-SKU','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','BOX',10),
 ('11111111-1111-4111-8111-111111111111','OTHER-ORG-PRODUCT','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','BOX',10),
 ('11111111-1111-4111-8111-111111111111','UNREVIEWED','cccccccc-cccc-4ccc-8ccc-cccccccccccc','BOX',10);
INSERT INTO public.erp2_branch_map(org_id,external_branch,warehouse_id)
VALUES
 ('11111111-1111-4111-8111-111111111111','MAIN','aaaaaaaa-0000-4000-8000-000000000001'),
 ('22222222-2222-4222-8222-222222222222','MAIN','bbbbbbbb-0000-4000-8000-000000000001');

DO $test$
DECLARE
  org_a uuid := '11111111-1111-4111-8111-111111111111';
  org_b uuid := '22222222-2222-4222-8222-222222222222';
  item jsonb := '{"external_item":"SAME-SKU","external_branch":"MAIN","source_version":1,"qty_available":"5.0000","unit_code":"BOX","selling_price":"100.0000","official_reference_price":null,"currency":"YER"}';
  result jsonb;
  n int;
BEGIN
  IF has_function_privilege('anon','public.erp2_apply_stock_snapshots(uuid,jsonb)','EXECUTE')
     OR has_function_privilege('authenticated','public.erp2_apply_stock_snapshots(uuid,jsonb)','EXECUTE')
     OR has_table_privilege('authenticated','public.erp2_stock_snapshots','SELECT')
     OR has_table_privilege('anon','public.erp2_stock_snapshots','SELECT')
  THEN RAISE EXCEPTION 'Browser roles received unexpected ERP2 access'; END IF;
  IF NOT has_function_privilege('service_role','public.erp2_apply_stock_snapshots(uuid,jsonb)','EXECUTE')
  THEN RAISE EXCEPTION 'Service role lacks ERP2 snapshot permission'; END IF;

  result := public.erp2_apply_stock_snapshots(org_a,jsonb_build_array(item));
  IF result->>'applied' <> '1' THEN RAISE EXCEPTION 'First org A snapshot was not applied'; END IF;
  result := public.erp2_apply_stock_snapshots(org_b,jsonb_build_array(item));
  IF result->>'applied' <> '1' THEN RAISE EXCEPTION 'First org B snapshot was not applied'; END IF;
  SELECT count(*) INTO n FROM public.erp2_stock_snapshots;
  IF n <> 2 THEN RAISE EXCEPTION 'Expected two tenant-isolated rows, got %',n; END IF;

  result := public.erp2_apply_stock_snapshots(org_a,jsonb_build_array(item));
  IF result->>'stale' <> '1' THEN RAISE EXCEPTION 'Identical version must be stale'; END IF;
  result := public.erp2_apply_stock_snapshots(org_a,jsonb_build_array(
    jsonb_set(jsonb_set(item,'{source_version}','2'::jsonb),'{qty_available}','"3.0000"'::jsonb)
  ));
  IF result->>'applied' <> '1' THEN RAISE EXCEPTION 'Higher version rejected'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.erp2_stock_snapshots s
    WHERE s.org_id=org_a AND s.source_version=2 AND s.qty_available=3
  ) THEN RAISE EXCEPTION 'Versioned quantity was not updated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.erp2_stock_snapshots s
    WHERE s.org_id=org_b AND s.source_version=1 AND s.qty_available=5
  ) THEN RAISE EXCEPTION 'Other organization snapshot changed'; END IF;

  -- Unknown mapping must not write or backfill another organization's SKU.
  BEGIN
    PERFORM public.erp2_apply_stock_snapshots(org_a,jsonb_build_array(
      jsonb_set(item,'{external_item}','"MISSING-MAP"'::jsonb)
    ));
    RAISE EXCEPTION 'UNKNOWN_MAPPING_ACCEPTED';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  BEGIN
    PERFORM public.erp2_apply_stock_snapshots(org_a,jsonb_build_array(
      jsonb_set(item,'{external_item}','"OTHER-ORG-PRODUCT"'::jsonb)
    ));
    RAISE EXCEPTION 'OTHER_ORG_PRODUCT_ACCEPTED';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  BEGIN
    PERFORM public.erp2_apply_stock_snapshots(org_a,jsonb_build_array(
      jsonb_set(item,'{external_item}','"UNREVIEWED"'::jsonb)
    ));
    RAISE EXCEPTION 'UNREVIEWED_PRODUCT_ACCEPTED';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  BEGIN
    PERFORM public.erp2_apply_stock_snapshots(org_a,jsonb_build_array(
      jsonb_set(item,'{qty_available}','"-1.0000"'::jsonb)
    ));
    RAISE EXCEPTION 'NEGATIVE_STOCK_ACCEPTED';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  BEGIN
    PERFORM public.erp2_apply_stock_snapshots(org_a,jsonb_build_array(
      jsonb_set(item,'{selling_price}','"1.12345"'::jsonb)
    ));
    RAISE EXCEPTION 'EXCESS_PRECISION_ACCEPTED';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  BEGIN
    PERFORM public.erp2_apply_stock_snapshots(
      '33333333-3333-4333-8333-333333333333',jsonb_build_array(item)
    );
    RAISE EXCEPTION 'SUSPENDED_ORG_ACCEPTED';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  -- Exact-body replay only; same key with changed payload is a conflict.
  result := public.erp2_claim_idempotency(org_a,'tenant-a-key-00001',repeat('a',64),'/api/public/erp/v2/stock');
  IF result->>'state' <> 'new' THEN RAISE EXCEPTION 'New idempotency was not created'; END IF;
  result := public.erp2_claim_idempotency(org_a,'tenant-a-key-00001',repeat('a',64),'/api/public/erp/v2/stock');
  IF result->>'state' <> 'in_progress' THEN RAISE EXCEPTION 'In-progress replay was not blocked'; END IF;
  result := public.erp2_claim_idempotency(org_a,'tenant-a-key-00001',repeat('b',64),'/api/public/erp/v2/stock');
  IF result->>'state' <> 'conflict' THEN RAISE EXCEPTION 'Mismatched body hash was not rejected'; END IF;

  PERFORM public.erp2_finish_idempotency(
    org_a,'tenant-a-key-00001',jsonb_build_object('status',200,'body',jsonb_build_object('ok',true))
  );
  result := public.erp2_claim_idempotency(org_a,'tenant-a-key-00001',repeat('a',64),'/api/public/erp/v2/stock');
  IF result->>'state' <> 'replay' OR result->'response'->'body'->>'ok' <> 'true'
  THEN RAISE EXCEPTION 'Completed idempotency replay is inconsistent'; END IF;
  result := public.erp2_claim_idempotency(org_b,'tenant-a-key-00001',repeat('a',64),'/api/public/erp/v2/stock');
  IF result->>'state' <> 'new' THEN RAISE EXCEPTION 'Other organization key was not isolated'; END IF;
END $test$;

-- Real service_role read to catch mistaken grants, RLS, and SECURITY INVOKER boundaries.
SET ROLE service_role;
-- Missing or malformed completion status must never mark an uncertain write done.
-- Run through the actual service role, not the database owner.
DO $completion$
DECLARE
  org_a uuid := '11111111-1111-4111-8111-111111111111';
  invalid_response jsonb;
  result jsonb;
  rejected integer := 0;
BEGIN
  result := public.erp2_claim_idempotency(
    org_a, 'completion-guard-0001', repeat('c',64), '/api/public/erp/v2/stock'
  );
  IF result->>'state' <> 'new' THEN RAISE EXCEPTION 'Completion fixture claim not created'; END IF;

  FOR invalid_response IN
    SELECT payload FROM (VALUES
      (NULL::jsonb), ('null'::jsonb), ('[]'::jsonb), ('true'::jsonb),
      ('{}'::jsonb), ('{"status":null}'::jsonb), ('{"status":"200"}'::jsonb),
      ('{"status":200.5}'::jsonb), ('{"status":true}'::jsonb),
      ('{"status":{}}'::jsonb), ('{"status":199}'::jsonb),
      ('{"status":500}'::jsonb), ('{"status":999999999999999999999999}'::jsonb)
    ) AS invalid(payload)
  LOOP
    BEGIN
      PERFORM public.erp2_finish_idempotency(org_a, 'completion-guard-0001', invalid_response);
      RAISE EXCEPTION 'INVALID_COMPLETION_ACCEPTED: %', invalid_response;
    EXCEPTION WHEN invalid_parameter_value THEN
      rejected := rejected + 1;
    END;
    IF NOT EXISTS (
      SELECT 1 FROM public.erp2_idempotency
      WHERE org_id = org_a AND idempotency_key = 'completion-guard-0001'
        AND status = 'processing' AND response IS NULL AND completed_at IS NULL
    ) THEN RAISE EXCEPTION 'Invalid completion changed the pending claim'; END IF;
  END LOOP;
  IF rejected <> 13 THEN RAISE EXCEPTION 'Expected 13 rejected completions, got %', rejected; END IF;

  PERFORM public.erp2_finish_idempotency(
    org_a, 'completion-guard-0001', '{"status":200,"body":{"ok":true}}'::jsonb
  );
  result := public.erp2_claim_idempotency(
    org_a, 'completion-guard-0001', repeat('c',64), '/api/public/erp/v2/stock'
  );
  IF result->>'state' <> 'replay' OR result->'response'->'body'->>'ok' <> 'true'
  THEN RAISE EXCEPTION 'Valid completion did not remain replayable'; END IF;

  -- A completed claim is immutable through the completion RPC.
  BEGIN
    PERFORM public.erp2_finish_idempotency(
      org_a, 'completion-guard-0001', '{"status":400,"body":{"error":"changed"}}'::jsonb
    );
    RAISE EXCEPTION 'COMPLETED_RESPONSE_OVERWRITTEN';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;
  IF NOT EXISTS (
    SELECT 1 FROM public.erp2_idempotency
    WHERE org_id = org_a AND idempotency_key = 'completion-guard-0001'
      AND status = 'done' AND response = '{"status":200,"body":{"ok":true}}'::jsonb
  ) THEN RAISE EXCEPTION 'Completed response changed'; END IF;
END $completion$;

DO $test$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.erp2_stock_snapshots;
  IF n <> 2 THEN RAISE EXCEPTION 'Service role could not inspect approved staging rows'; END IF;
  IF NOT has_function_privilege('service_role','public.erp2_claim_idempotency(uuid,text,text,text)','EXECUTE')
  THEN RAISE EXCEPTION 'Service role cannot claim idempotency'; END IF;
END $test$;
RESET ROLE;
SELECT 'ERP2 SQL tenant isolation tests passed (disposable staging only)' AS result;
