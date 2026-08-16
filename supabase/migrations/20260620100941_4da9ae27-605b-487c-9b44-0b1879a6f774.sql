
-- ============================================================
-- Hardened transfer stock functions
--   * Transactional (single plpgsql block, all-or-nothing)
--   * Idempotent (advisory lock + state guard at entry)
--   * Deadlock-safe (deterministic row lock order by product_id)
--   * No negative inventory (table CHECKs + in-fn re-verify)
-- ============================================================

-- 1. Tighten the table-level safety net --------------------------------

ALTER TABLE public.branch_inventory
  DROP CONSTRAINT IF EXISTS branch_inventory_qty_check,
  DROP CONSTRAINT IF EXISTS branch_inventory_reserved_qty_check,
  DROP CONSTRAINT IF EXISTS branch_inventory_check;

ALTER TABLE public.branch_inventory
  ADD CONSTRAINT branch_inventory_qty_nonneg          CHECK (qty >= 0),
  ADD CONSTRAINT branch_inventory_reserved_nonneg     CHECK (reserved_qty >= 0),
  ADD CONSTRAINT branch_inventory_reserved_le_qty     CHECK (reserved_qty <= qty);

-- 2. reserve_transfer_stock -------------------------------------------

CREATE OR REPLACE FUNCTION public.reserve_transfer_stock(_transfer_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t         public.inventory_transfers%ROWTYPE;
  itm       public.transfer_items%ROWTYPE;
  available integer;
BEGIN
  -- Idempotency: only one reserve/release/commit per transfer at a time.
  PERFORM pg_advisory_xact_lock(hashtextextended(_transfer_id::text, 0));

  -- Lock the transfer header.
  SELECT * INTO t
    FROM public.inventory_transfers
   WHERE id = _transfer_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transfer % not found', _transfer_id USING ERRCODE = 'P0002';
  END IF;

  -- Idempotent re-entry.
  IF t.status = 'RESERVED' THEN
    RETURN 'SKIPPED_ALREADY_RESERVED';
  END IF;
  IF t.status <> 'APPROVED' THEN
    RAISE EXCEPTION 'reserve requires APPROVED, current=%', t.status
      USING ERRCODE = 'check_violation';
  END IF;
  IF t.source_branch_id IS NULL THEN
    RAISE EXCEPTION 'source branch required to reserve'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Walk items in deterministic order to avoid deadlocks vs. concurrent
  -- transfers that touch overlapping products.
  FOR itm IN
    SELECT *
      FROM public.transfer_items
     WHERE transfer_id = _transfer_id
     ORDER BY product_id
  LOOP
    -- Lock the inventory row (or fail if it doesn't exist yet).
    SELECT (qty - reserved_qty)
      INTO available
      FROM public.branch_inventory
     WHERE branch_id  = t.source_branch_id
       AND product_id = itm.product_id
     FOR UPDATE;

    IF available IS NULL THEN
      RAISE EXCEPTION 'no inventory row at source for product %', itm.product_id
        USING ERRCODE = 'check_violation';
    END IF;

    IF available < itm.qty_requested THEN
      RAISE EXCEPTION
        'insufficient stock at source for product %: available=%, need=%',
        itm.product_id, available, itm.qty_requested
        USING ERRCODE = 'check_violation';
    END IF;

    -- Safe to reserve. branch_inventory_reserved_le_qty CHECK is a final
    -- belt-and-braces guard against negative inventory.
    UPDATE public.branch_inventory
       SET reserved_qty = reserved_qty + itm.qty_requested,
           updated_at   = now()
     WHERE branch_id  = t.source_branch_id
       AND product_id = itm.product_id;
  END LOOP;

  UPDATE public.inventory_transfers
     SET status = 'RESERVED'
   WHERE id = _transfer_id;

  RETURN 'OK_RESERVED';
END
$$;

-- 3. release_transfer_reservation -------------------------------------

CREATE OR REPLACE FUNCTION public.release_transfer_reservation(
  _transfer_id uuid,
  _reason      text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t   public.inventory_transfers%ROWTYPE;
  itm public.transfer_items%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(_transfer_id::text, 0));

  SELECT * INTO t
    FROM public.inventory_transfers
   WHERE id = _transfer_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transfer % not found', _transfer_id USING ERRCODE = 'P0002';
  END IF;

  IF t.status NOT IN ('RESERVED','PICKING','PACKED') THEN
    RETURN 'SKIPPED_NO_RESERVATION';
  END IF;

  FOR itm IN
    SELECT *
      FROM public.transfer_items
     WHERE transfer_id = _transfer_id
     ORDER BY product_id
  LOOP
    -- Lock then release. GREATEST() guarantees we never push reserved_qty
    -- below zero, even if the row was concurrently adjusted by an admin.
    PERFORM 1
       FROM public.branch_inventory
      WHERE branch_id  = t.source_branch_id
        AND product_id = itm.product_id
      FOR UPDATE;

    UPDATE public.branch_inventory
       SET reserved_qty = GREATEST(0, reserved_qty - itm.qty_requested),
           updated_at   = now()
     WHERE branch_id  = t.source_branch_id
       AND product_id = itm.product_id;
  END LOOP;

  RETURN 'OK_RELEASED';
END
$$;

-- 4. commit_transfer_receipt ------------------------------------------

CREATE OR REPLACE FUNCTION public.commit_transfer_receipt(_transfer_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t          public.inventory_transfers%ROWTYPE;
  itm        public.transfer_items%ROWTYPE;
  move_qty   integer;
  src_qty    integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(_transfer_id::text, 0));

  SELECT * INTO t
    FROM public.inventory_transfers
   WHERE id = _transfer_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transfer % not found', _transfer_id USING ERRCODE = 'P0002';
  END IF;

  IF t.status = 'COMPLETED' THEN
    RETURN 'SKIPPED_ALREADY_COMPLETED';
  END IF;
  IF t.status <> 'RECEIVED' THEN
    RAISE EXCEPTION 'commit requires RECEIVED, current=%', t.status
      USING ERRCODE = 'check_violation';
  END IF;
  IF t.destination_branch_id IS NULL THEN
    RAISE EXCEPTION 'destination branch required'
      USING ERRCODE = 'check_violation';
  END IF;

  FOR itm IN
    SELECT *
      FROM public.transfer_items
     WHERE transfer_id = _transfer_id
     ORDER BY product_id
  LOOP
    -- Received qty falls back to requested when receiver didn't override.
    move_qty := COALESCE(NULLIF(itm.qty_received, 0), itm.qty_requested);

    -- ---- Source: decrement (consume the reservation) -----------------
    IF t.source_branch_id IS NOT NULL THEN
      SELECT qty INTO src_qty
        FROM public.branch_inventory
       WHERE branch_id  = t.source_branch_id
         AND product_id = itm.product_id
       FOR UPDATE;

      IF src_qty IS NULL OR src_qty < itm.qty_requested THEN
        RAISE EXCEPTION
          'cannot commit: source stock dropped below reserved for product % (have=%, reserved/need=%)',
          itm.product_id, COALESCE(src_qty,0), itm.qty_requested
          USING ERRCODE = 'check_violation';
      END IF;

      UPDATE public.branch_inventory
         SET qty          = qty - itm.qty_requested,
             reserved_qty = GREATEST(0, reserved_qty - itm.qty_requested),
             updated_at   = now()
       WHERE branch_id  = t.source_branch_id
         AND product_id = itm.product_id;
    END IF;

    -- ---- Destination: increment (create row if missing) --------------
    INSERT INTO public.branch_inventory(branch_id, product_id, qty)
    VALUES (t.destination_branch_id, itm.product_id, move_qty)
    ON CONFLICT (branch_id, product_id)
      DO UPDATE SET qty        = public.branch_inventory.qty + EXCLUDED.qty,
                    updated_at = now();
  END LOOP;

  -- Refresh cached products.stock_qty (sum across all branches).
  UPDATE public.products p
     SET stock_qty = COALESCE((
       SELECT SUM(qty) FROM public.branch_inventory bi WHERE bi.product_id = p.id
     ), 0)
   WHERE p.id IN (SELECT product_id FROM public.transfer_items WHERE transfer_id = _transfer_id);

  UPDATE public.inventory_transfers
     SET status = 'COMPLETED'
   WHERE id = _transfer_id;

  RETURN 'OK_COMPLETED';
END
$$;

-- 5. Lock down EXECUTE to known roles ---------------------------------

REVOKE EXECUTE ON FUNCTION public.reserve_transfer_stock(uuid)            FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_transfer_reservation(uuid,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.commit_transfer_receipt(uuid)           FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.reserve_transfer_stock(uuid)             TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_transfer_reservation(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.commit_transfer_receipt(uuid)            TO authenticated, service_role;
