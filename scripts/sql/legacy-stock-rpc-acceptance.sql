-- Synthetic, disposable PostgreSQL only. Fail test on any incorrect behavior.
\set ON_ERROR_STOP on

SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false
);

-- A permitted adjustment from 10/8 to 9/8 must write exactly one movement.
SELECT public.inv_adjust_stock(
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', -1, 'reconciliation verification'
);

DO $test$
DECLARE blocked boolean := false;
BEGIN
  BEGIN
    -- 9 on hand / 8 reserved: reducing by 2 must not happen.
    PERFORM public.inv_adjust_stock(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', -2, 'below reserved'
    );
  EXCEPTION WHEN check_violation THEN
    blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'unsafe stock decrease was accepted'; END IF;
END;
$test$;

DO $test$
DECLARE blocked boolean := false;
BEGIN
  BEGIN
    PERFORM public.inv_adjust_stock(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 0, 'zero delta'
    );
  EXCEPTION WHEN invalid_parameter_value THEN
    blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'zero stock delta was accepted'; END IF;
END;
$test$;

DO $test$
DECLARE blocked boolean := false;
BEGIN
  BEGIN
    PERFORM public.inv_adjust_stock(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'NaN'::numeric, 'invalid numeric'
    );
  EXCEPTION WHEN invalid_parameter_value THEN
    blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'NaN stock delta was accepted'; END IF;
END;
$test$;

-- Simulate the identity of a user who belongs to a different tenant.
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false
);
DO $test$
DECLARE blocked boolean := false;
BEGIN
  BEGIN
    PERFORM public.inv_adjust_stock(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 1, 'cross tenant'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'cross-tenant adjustment was accepted'; END IF;
END;
$test$;

-- Without a valid caller identity, SECURITY DEFINER must not act on a batch.
SELECT pg_catalog.set_config('request.jwt.claim.sub', '', false);
DO $test$
DECLARE blocked boolean := false;
BEGIN
  BEGIN
    PERFORM public.inv_adjust_stock(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 1, 'anonymous request'
    );
  EXCEPTION WHEN invalid_authorization_specification THEN
    blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'anonymous adjustment was accepted'; END IF;
END;
$test$;
RESET ROLE;

-- Even privileged table writes must respect the global reservation constraint.
DO $test$
DECLARE blocked boolean := false;
BEGIN
  BEGIN
    UPDATE public.inv_stock_batches
    SET qty_reserved = 10
    WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  EXCEPTION WHEN check_violation THEN
    blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'stock reservation constraint was bypassed'; END IF;
END;
$test$;

-- Try a batch linked to the wrong warehouse organization.
INSERT INTO public.inv_stock_batches (
  id,organization_id,warehouse_id,product_id,qty_on_hand,qty_reserved
) VALUES (
  'abababab-abab-4bab-8bab-abababababab',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  5,0
);
SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false
);
DO $test$
DECLARE blocked boolean := false;
BEGIN
  BEGIN
    PERFORM public.inv_adjust_stock(
      'abababab-abab-4bab-8bab-abababababab', 1, 'mismatched warehouse'
    );
  EXCEPTION WHEN check_violation THEN
    blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'warehouse organization mismatch was accepted'; END IF;
END;
$test$;
RESET ROLE;

-- Verify exact movement accounting; invalid attempts caused no movements.
DO $test$
DECLARE movements int;
DECLARE onhand numeric;
DECLARE reserved numeric;
DECLARE events int;
BEGIN
  SELECT count(*) INTO movements
  FROM public.inv_stock_movements
  WHERE batch_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  SELECT qty_on_hand,qty_reserved INTO onhand,reserved
  FROM public.inv_stock_batches
  WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  SELECT count(*) INTO events FROM public.synthetic_events;

  IF movements <> 1 OR onhand <> 9 OR reserved <> 8 OR events <> 1 THEN
    RAISE EXCEPTION 'movement, batch, or event inconsistency: % / % / % / %',
      movements,onhand,reserved,events;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.inv_stock_movements
    WHERE actor_user_id = '11111111-1111-4111-8111-111111111111'
      AND qty_delta = -1
      AND metadata->>'source' = 'legacy_inv_adjust_stock'
  ) THEN
    RAISE EXCEPTION 'audit movement missing actor or provenance';
  END IF;

  IF has_function_privilege('anon','public.inv_adjust_stock(uuid,numeric,text)','EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute legacy inventory adjustment';
  END IF;
  IF NOT has_function_privilege('authenticated','public.inv_adjust_stock(uuid,numeric,text)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated legacy adjustment contract broken';
  END IF;
END;
$test$;
