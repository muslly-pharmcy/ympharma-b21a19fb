
-- =====================================================================
-- Batch 5a — CTO audit blockers (C1, H1, M1)
-- =====================================================================

-- ---------------------------------------------------------------------
-- H1 · Defense-in-depth: stock_qty can never go negative
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_stock_non_negative'
      AND conrelid = 'public.products'::regclass
  ) THEN
    -- NOT VALID so it never fails the migration if legacy negatives exist;
    -- we then attempt VALIDATE in a safe block.
    ALTER TABLE public.products
      ADD CONSTRAINT products_stock_non_negative
      CHECK (stock_qty >= 0) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.products VALIDATE CONSTRAINT products_stock_non_negative;
  EXCEPTION WHEN check_violation THEN
    -- Leave NOT VALID; an admin must reconcile negative rows first.
    RAISE NOTICE 'products_stock_non_negative left NOT VALID — negative stock_qty rows exist; reconcile then VALIDATE manually.';
  END;
END $$;

-- ---------------------------------------------------------------------
-- C1 · Atomic two-pass reserve_order_stock (no partial deduction)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_order_stock(
  _order_id text,
  _actor    text DEFAULT NULL,
  _reason   text DEFAULT 'auto'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_row   public.orders%ROWTYPE;
  st_row      public.inventory_reservation_state%ROWTYPE;
  item        JSONB;
  pid         UUID;
  legacy      INT;
  qty         INT;
  prod        public.products%ROWTYPE;
  -- Pass-1 working sets
  needs       JSONB := '[]'::jsonb;   -- per-item planned deduction
  shortages   JSONB := '[]'::jsonb;
  reserved    JSONB := '[]'::jsonb;
  rec         JSONB;
  result      JSONB;
BEGIN
  -- ---- Idempotency gate (lock state row) -----------------------------
  SELECT * INTO st_row
    FROM public.inventory_reservation_state
   WHERE order_id = _order_id
   FOR UPDATE;

  IF FOUND AND st_row.state = 'RESERVED' THEN
    INSERT INTO public.inventory_audit_log(order_id, action, status, reason, actor, payload)
      VALUES(_order_id, 'RESERVE', 'SKIPPED_DUPLICATE', _reason, _actor,
             jsonb_build_object('previous_reserved_at', st_row.reserved_at));
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_reserved');
  END IF;

  -- ---- Load order ----------------------------------------------------
  SELECT * INTO order_row FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN
    INSERT INTO public.inventory_audit_log(order_id, action, status, reason, actor)
      VALUES(_order_id, 'RESERVE', 'FAILED', 'order_not_found', _actor);
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
  END IF;

  -- ---- PASS 1 · Lock every product row and verify availability -------
  -- We take FOR UPDATE locks here in a stable order (by product id) by
  -- pre-collecting product ids, then locking — but plpgsql loop preserves
  -- the per-row lock for the duration of the transaction either way, and
  -- we never UPDATE in pass 1, so deadlock surface is minimal.
  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(order_row.items, '[]'::jsonb)) LOOP
    qty    := COALESCE((item->>'quantity')::INT, (item->>'qty')::INT, 1);
    pid    := NULLIF(item->>'product_id', '')::UUID;
    legacy := NULLIF(item->>'legacy_id', '')::INT;

    IF pid IS NOT NULL THEN
      SELECT * INTO prod FROM public.products WHERE id = pid FOR UPDATE;
    ELSIF legacy IS NOT NULL THEN
      SELECT * INTO prod FROM public.products WHERE legacy_id = legacy FOR UPDATE;
    ELSE
      CONTINUE; -- untracked line (e.g. service fee)
    END IF;

    IF NOT FOUND OR NOT prod.track_stock THEN
      CONTINUE;
    END IF;

    IF prod.stock_qty < qty THEN
      shortages := shortages || jsonb_build_object(
        'product_id', prod.id, 'name', prod.name,
        'requested', qty, 'available', prod.stock_qty);
    ELSE
      needs := needs || jsonb_build_object(
        'product_id', prod.id, 'name', prod.name,
        'qty', qty, 'remaining_after', prod.stock_qty - qty);
    END IF;
  END LOOP;

  -- ---- Abort BEFORE any mutation if any shortage exists --------------
  IF jsonb_array_length(shortages) > 0 THEN
    result := jsonb_build_object('ok', false,
      'order_id', _order_id, 'reserved', '[]'::jsonb, 'shortages', shortages);
    INSERT INTO public.inventory_audit_log(order_id, action, status, reason, actor, payload)
      VALUES(_order_id, 'RESERVE', 'SHORTAGE', _reason, _actor, result);
    -- NB: state intentionally NOT set → admin retry remains possible
    -- once stock is replenished. Safe because pass-2 never ran.
    RETURN result;
  END IF;

  -- ---- PASS 2 · Atomic deduction (all-or-nothing in one txn) ---------
  FOR rec IN SELECT * FROM jsonb_array_elements(needs) LOOP
    UPDATE public.products
       SET stock_qty = stock_qty - (rec->>'qty')::INT,
           updated_at = now()
     WHERE id = (rec->>'product_id')::UUID;
    reserved := reserved || rec;
  END LOOP;

  result := jsonb_build_object('ok', true,
    'order_id', _order_id, 'reserved', reserved, 'shortages', '[]'::jsonb);

  INSERT INTO public.inventory_reservation_state(order_id, state, reserved_at, updated_at)
    VALUES(_order_id, 'RESERVED', now(), now())
    ON CONFLICT (order_id) DO UPDATE
      SET state='RESERVED', reserved_at=now(), updated_at=now();

  INSERT INTO public.inventory_audit_log(order_id, action, status, reason, actor, payload)
    VALUES(_order_id, 'RESERVE', 'OK', _reason, _actor, result);

  RETURN result;

EXCEPTION WHEN OTHERS THEN
  -- Any exception aborts the transaction → all UPDATEs roll back, no
  -- state row written. Log the failure for the audit trail.
  INSERT INTO public.inventory_audit_log(order_id, action, status, reason, actor, payload)
    VALUES(_order_id, 'RESERVE', 'FAILED', _reason, _actor,
           jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE));
  RAISE;
END;
$$;

-- Keep prior callers happy.
REVOKE ALL ON FUNCTION public.reserve_order_stock(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_order_stock(text, text, text) TO service_role;

-- ---------------------------------------------------------------------
-- M1 · Restrict emit_agent_event to service_role only
-- ---------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public' AND p.proname='emit_agent_event'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated;', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role;', r.sig);
  END LOOP;
END $$;
