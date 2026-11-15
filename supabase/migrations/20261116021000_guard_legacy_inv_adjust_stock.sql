-- YmPharma G1 / issue #68 — LEGACY 3-argument stock adjustment.
-- SOURCE: exact live public.inv_adjust_stock(uuid,numeric,text) signature checked
-- against MUSALLY PHARMA on 2026-11-16.
--
-- DO NOT APPLY TO PRODUCTION UNTIL:
-- 1) source-of-truth migration history is reconciled (issue #70);
-- 2) isolated staging reproduces the direct authenticated RPC and the 500-way
--    concurrency tests; and 3) backup/restore and migration rollback are proven.
--
-- This patch preserves the legacy RPC signature and return type, and hardens
-- database invariants globally. It does not provide an idempotency key for the
-- legacy RPC; exactly-once inventory commands are a separate required follow-up.

-- Both checks below MUST be evaluated on the same row under one transaction.
-- This database constraint protects every writer, not only this RPC.
ALTER TABLE public.inv_stock_batches
  ADD CONSTRAINT inv_stock_batches_reserved_not_above_hand
  CHECK (qty_reserved <= qty_on_hand) NOT VALID;

-- Fails rather than approving inconsistent historical stock.
ALTER TABLE public.inv_stock_batches
  VALIDATE CONSTRAINT inv_stock_batches_reserved_not_above_hand;

CREATE OR REPLACE FUNCTION public.inv_adjust_stock(
  _batch uuid,
  _qty_delta numeric,
  _reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_batch public.inv_stock_batches%ROWTYPE;
  v_new_qty numeric;
  v_movement uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authenticated actor required'
      USING ERRCODE = '28000';
  END IF;

  IF _batch IS NULL
     OR _qty_delta IS NULL
     OR _qty_delta::text IN ('NaN', 'Infinity', '-Infinity')
     OR _qty_delta = 0 THEN
    RAISE EXCEPTION 'invalid stock adjustment input'
      USING ERRCODE = '22023';
  END IF;

  IF _reason IS NULL OR
     pg_catalog.length(pg_catalog.btrim(_reason)) NOT BETWEEN 2 AND 200 THEN
    RAISE EXCEPTION 'a stock adjustment reason of 2-200 characters is required'
      USING ERRCODE = '22023';
  END IF;

  -- Row lock serializes this adjustment with other writers that update or
  -- lock the same batch; the reservation invariant also exists as a CHECK.
  SELECT * INTO v_batch
  FROM public.inv_stock_batches
  WHERE id = _batch
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'stock batch not found' USING ERRCODE = 'P0002';
  END IF;

  IF COALESCE(
    public.has_org_permission(v_actor, v_batch.organization_id, 'inventory.write'),
    false
  ) IS NOT TRUE THEN
    RAISE EXCEPTION 'inventory.write permission required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.wh_warehouses AS w
    WHERE w.id = v_batch.warehouse_id
      AND w.organization_id = v_batch.organization_id
  ) THEN
    RAISE EXCEPTION 'batch warehouse organization mismatch'
      USING ERRCODE = '23514';
  END IF;

  v_new_qty := v_batch.qty_on_hand + _qty_delta;
  IF v_new_qty < 0 OR v_new_qty < v_batch.qty_reserved THEN
    RAISE EXCEPTION 'adjustment would exceed unreserved stock'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.inv_stock_batches
  SET qty_on_hand = v_new_qty, updated_at = now()
  WHERE id = v_batch.id;

  -- The movement row is inserted in the same transaction as stock adjustment.
  -- On any failure, the entire RPC transaction rolls back.
  INSERT INTO public.inv_stock_movements (
    organization_id, warehouse_id, batch_id, product_id,
    movement_type, qty_delta, actor_user_id, reason, metadata
  ) VALUES (
    v_batch.organization_id, v_batch.warehouse_id,
    v_batch.id, v_batch.product_id,
    'STOCK_ADJUSTED', _qty_delta, v_actor, _reason,
    pg_catalog.jsonb_build_object('source', 'legacy_inv_adjust_stock')
  ) RETURNING id INTO v_movement;

  PERFORM public.inv_emit_event(
    'STOCK_MOVEMENT_CREATED', v_batch.organization_id,
    'inv_stock_movement', v_movement,
    pg_catalog.jsonb_build_object(
      'batch_id', _batch,
      'qty_delta', _qty_delta,
      'type', 'STOCK_ADJUSTED'
    )
  );

  RETURN v_movement;
END;
$function$;

-- Preserve the existing authenticated role contract but never grant to anon.
-- The function itself enforces actor identity and organization membership.
REVOKE ALL ON FUNCTION public.inv_adjust_stock(uuid, numeric, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inv_adjust_stock(uuid, numeric, text)
  TO authenticated, service_role;
