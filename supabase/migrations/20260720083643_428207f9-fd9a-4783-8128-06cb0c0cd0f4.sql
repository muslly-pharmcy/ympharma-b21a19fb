
-- =========================================================
-- Phase 3 Shipment B — Inventory Transaction Engine
-- =========================================================

-- ---------- ENUM: PO status ----------
DO $$ BEGIN
  CREATE TYPE public.po_status AS ENUM ('draft','submitted','approved','received','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- purchase_orders ----------
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  supplier_id     uuid NOT NULL REFERENCES public.sup_suppliers(id) ON DELETE RESTRICT,
  warehouse_id    uuid NOT NULL REFERENCES public.wh_warehouses(id) ON DELETE RESTRICT,
  code            text NOT NULL,
  status          public.po_status NOT NULL DEFAULT 'draft',
  notes           text,
  total_amount    numeric(14,4) NOT NULL DEFAULT 0,
  currency        text NOT NULL DEFAULT 'SAR',
  created_by      uuid,
  approved_by     uuid,
  approved_at     timestamptz,
  received_at     timestamptz,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_orders_read" ON public.purchase_orders
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "purchase_orders_write" ON public.purchase_orders
  FOR ALL TO authenticated
  USING (public.has_org_permission(auth.uid(), organization_id, 'purchasing.write'))
  WITH CHECK (public.has_org_permission(auth.uid(), organization_id, 'purchasing.write'));

CREATE INDEX IF NOT EXISTS purchase_orders_org_status_idx
  ON public.purchase_orders(organization_id, status, created_at DESC);

CREATE TRIGGER trg_purchase_orders_updated
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- purchase_order_lines ----------
CREATE TABLE IF NOT EXISTS public.purchase_order_lines (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id         uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id    uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE RESTRICT,
  line_no       integer NOT NULL,
  qty_ordered   numeric(14,3) NOT NULL CHECK (qty_ordered > 0),
  qty_received  numeric(14,3) NOT NULL DEFAULT 0 CHECK (qty_received >= 0),
  unit_cost     numeric(14,4) NOT NULL DEFAULT 0,
  batch_no      text,
  expiry_date   date,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (po_id, line_no)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_lines TO authenticated;
GRANT ALL ON public.purchase_order_lines TO service_role;

ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_order_lines_read" ON public.purchase_order_lines
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = po_id AND public.is_org_member(po.organization_id, auth.uid())
  ));

CREATE POLICY "purchase_order_lines_write" ON public.purchase_order_lines
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = po_id AND public.has_org_permission(auth.uid(), po.organization_id, 'purchasing.write')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = po_id AND public.has_org_permission(auth.uid(), po.organization_id, 'purchasing.write')
  ));

CREATE INDEX IF NOT EXISTS purchase_order_lines_po_idx
  ON public.purchase_order_lines(po_id, line_no);

CREATE TRIGGER trg_purchase_order_lines_updated
  BEFORE UPDATE ON public.purchase_order_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- inv_reservations (FEFO) ----------
CREATE TABLE IF NOT EXISTS public.inv_reservations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE RESTRICT,
  qty             numeric(14,3) NOT NULL CHECK (qty > 0),
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','released','consumed')),
  allocations     jsonb NOT NULL DEFAULT '[]'::jsonb,
  ref_type        text,
  ref_id          uuid,
  actor_user_id   uuid,
  correlation_id  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  released_at     timestamptz,
  consumed_at     timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inv_reservations TO authenticated;
GRANT ALL ON public.inv_reservations TO service_role;

ALTER TABLE public.inv_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_reservations_read" ON public.inv_reservations
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "inv_reservations_write" ON public.inv_reservations
  FOR ALL TO authenticated
  USING (public.has_org_permission(auth.uid(), organization_id, 'inventory.write'))
  WITH CHECK (public.has_org_permission(auth.uid(), organization_id, 'inventory.write'));

CREATE INDEX IF NOT EXISTS inv_reservations_active_idx
  ON public.inv_reservations(organization_id, product_id, status);

CREATE TRIGGER trg_inv_reservations_updated
  BEFORE UPDATE ON public.inv_reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- inventory_idempotency ----------
CREATE TABLE IF NOT EXISTS public.inventory_idempotency (
  key         text PRIMARY KEY,
  actor_id    uuid,
  command     text NOT NULL,
  response    jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.inventory_idempotency TO authenticated;
GRANT ALL ON public.inventory_idempotency TO service_role;

ALTER TABLE public.inventory_idempotency ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_idempotency_service_only" ON public.inventory_idempotency
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS inventory_idempotency_created_idx
  ON public.inventory_idempotency(created_at);

-- =========================================================
-- FUNCTIONS — atomic inventory operations
-- =========================================================

-- Emit + return helper (thin wrapper matching existing sig)
CREATE OR REPLACE FUNCTION public.inv_emit(
  p_type text, p_payload jsonb, p_correlation text
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.emit_domain_event(p_type, 'inventory-engine', p_payload, 'normal', p_correlation);
  SELECT NULL::void;
$$;

REVOKE ALL ON FUNCTION public.inv_emit(text,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inv_emit(text,jsonb,text) TO authenticated, service_role;

-- ---------- inv_receive_stock ----------
CREATE OR REPLACE FUNCTION public.inv_receive_stock(
  p_org uuid, p_warehouse uuid, p_product uuid, p_supplier uuid,
  p_qty numeric, p_cost numeric, p_batch text, p_expiry date,
  p_actor uuid, p_correlation text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_batch_id uuid;
BEGIN
  IF p_qty <= 0 THEN RAISE EXCEPTION 'qty must be positive'; END IF;

  INSERT INTO public.inv_stock_batches (
    organization_id, warehouse_id, product_id, supplier_id,
    batch_no, expiry_date, qty_on_hand, cost, received_at
  )
  VALUES (p_org, p_warehouse, p_product, p_supplier,
          p_batch, p_expiry, p_qty, p_cost, now())
  ON CONFLICT (warehouse_id, product_id, COALESCE(batch_no,''), COALESCE(expiry_date,'infinity'::date))
  DO UPDATE SET
    qty_on_hand = inv_stock_batches.qty_on_hand + EXCLUDED.qty_on_hand,
    cost        = COALESCE(EXCLUDED.cost, inv_stock_batches.cost),
    updated_at  = now()
  RETURNING id INTO v_batch_id;

  INSERT INTO public.inv_stock_movements (
    organization_id, warehouse_id, batch_id, product_id,
    movement_type, qty_delta, actor_user_id, reason, metadata
  ) VALUES (
    p_org, p_warehouse, v_batch_id, p_product,
    'STOCK_RECEIVED', p_qty, p_actor, 'receipt',
    jsonb_build_object('correlation_id', p_correlation, 'cost', p_cost, 'batch_no', p_batch, 'expiry', p_expiry)
  );

  PERFORM public.inv_emit('StockReceived',
    jsonb_build_object('batch_id', v_batch_id, 'product_id', p_product, 'qty', p_qty, 'warehouse_id', p_warehouse),
    p_correlation);
  RETURN v_batch_id;
END $$;

REVOKE ALL ON FUNCTION public.inv_receive_stock(uuid,uuid,uuid,uuid,numeric,numeric,text,date,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inv_receive_stock(uuid,uuid,uuid,uuid,numeric,numeric,text,date,uuid,text) TO authenticated, service_role;

-- ---------- inv_adjust_stock ----------
CREATE OR REPLACE FUNCTION public.inv_adjust_stock(
  p_batch uuid, p_delta numeric, p_reason text,
  p_actor uuid, p_correlation text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch public.inv_stock_batches%ROWTYPE;
  v_new_qty numeric;
  v_move_id uuid;
BEGIN
  SELECT * INTO v_batch FROM public.inv_stock_batches WHERE id = p_batch FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'batch % not found', p_batch; END IF;

  v_new_qty := v_batch.qty_on_hand + p_delta;
  IF v_new_qty < v_batch.qty_reserved THEN
    RAISE EXCEPTION 'adjustment would break reservations (new % < reserved %)', v_new_qty, v_batch.qty_reserved;
  END IF;

  UPDATE public.inv_stock_batches SET qty_on_hand = v_new_qty, updated_at = now() WHERE id = p_batch;

  INSERT INTO public.inv_stock_movements (
    organization_id, warehouse_id, batch_id, product_id,
    movement_type, qty_delta, actor_user_id, reason, metadata
  ) VALUES (
    v_batch.organization_id, v_batch.warehouse_id, v_batch.id, v_batch.product_id,
    'STOCK_ADJUSTED', p_delta, p_actor, p_reason,
    jsonb_build_object('correlation_id', p_correlation)
  ) RETURNING id INTO v_move_id;

  PERFORM public.inv_emit('StockAdjusted',
    jsonb_build_object('batch_id', p_batch, 'delta', p_delta, 'reason', p_reason),
    p_correlation);
  RETURN v_move_id;
END $$;

REVOKE ALL ON FUNCTION public.inv_adjust_stock(uuid,numeric,text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inv_adjust_stock(uuid,numeric,text,uuid,text) TO authenticated, service_role;

-- ---------- inv_reserve_fefo ----------
CREATE OR REPLACE FUNCTION public.inv_reserve_fefo(
  p_org uuid, p_product uuid, p_qty numeric,
  p_ref_type text, p_ref_id uuid,
  p_actor uuid, p_correlation text, p_allow_partial boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining numeric := p_qty;
  v_alloc jsonb := '[]'::jsonb;
  v_batch record;
  v_take numeric;
  v_reservation_id uuid;
BEGIN
  IF p_qty <= 0 THEN RAISE EXCEPTION 'qty must be positive'; END IF;

  FOR v_batch IN
    SELECT id, qty_on_hand, qty_reserved, expiry_date, warehouse_id
    FROM public.inv_stock_batches
    WHERE organization_id = p_org
      AND product_id = p_product
      AND (expiry_date IS NULL OR expiry_date > CURRENT_DATE)
      AND qty_on_hand > qty_reserved
    ORDER BY expiry_date NULLS LAST, received_at
    FOR UPDATE SKIP LOCKED
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(v_remaining, v_batch.qty_on_hand - v_batch.qty_reserved);
    IF v_take <= 0 THEN CONTINUE; END IF;

    UPDATE public.inv_stock_batches
      SET qty_reserved = qty_reserved + v_take, updated_at = now()
    WHERE id = v_batch.id;

    v_alloc := v_alloc || jsonb_build_array(
      jsonb_build_object('batch_id', v_batch.id, 'qty', v_take, 'warehouse_id', v_batch.warehouse_id, 'expiry', v_batch.expiry_date)
    );
    v_remaining := v_remaining - v_take;
  END LOOP;

  IF v_remaining > 0 AND NOT p_allow_partial THEN
    RAISE EXCEPTION 'insufficient stock: short by %', v_remaining;
  END IF;

  INSERT INTO public.inv_reservations (
    organization_id, product_id, qty, status, allocations,
    ref_type, ref_id, actor_user_id, correlation_id
  ) VALUES (
    p_org, p_product, p_qty - v_remaining, 'active', v_alloc,
    p_ref_type, p_ref_id, p_actor, p_correlation
  ) RETURNING id INTO v_reservation_id;

  PERFORM public.inv_emit('StockReserved',
    jsonb_build_object('reservation_id', v_reservation_id, 'product_id', p_product, 'qty', p_qty - v_remaining, 'allocations', v_alloc),
    p_correlation);
  RETURN v_reservation_id;
END $$;

REVOKE ALL ON FUNCTION public.inv_reserve_fefo(uuid,uuid,numeric,text,uuid,uuid,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inv_reserve_fefo(uuid,uuid,numeric,text,uuid,uuid,text,boolean) TO authenticated, service_role;

-- ---------- inv_release_reservation ----------
CREATE OR REPLACE FUNCTION public.inv_release_reservation(
  p_reservation uuid, p_actor uuid, p_correlation text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res public.inv_reservations%ROWTYPE;
  v_alloc jsonb;
BEGIN
  SELECT * INTO v_res FROM public.inv_reservations WHERE id = p_reservation FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'reservation % not found', p_reservation; END IF;
  IF v_res.status <> 'active' THEN RAISE EXCEPTION 'reservation not active (status=%)', v_res.status; END IF;

  FOR v_alloc IN SELECT * FROM jsonb_array_elements(v_res.allocations) LOOP
    UPDATE public.inv_stock_batches
      SET qty_reserved = GREATEST(0, qty_reserved - (v_alloc->>'qty')::numeric), updated_at = now()
    WHERE id = (v_alloc->>'batch_id')::uuid;
  END LOOP;

  UPDATE public.inv_reservations
    SET status = 'released', released_at = now(), updated_at = now()
  WHERE id = p_reservation;

  PERFORM public.inv_emit('ReservationReleased',
    jsonb_build_object('reservation_id', p_reservation),
    p_correlation);
END $$;

REVOKE ALL ON FUNCTION public.inv_release_reservation(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inv_release_reservation(uuid,uuid,text) TO authenticated, service_role;

-- ---------- inv_consume_reservation ----------
CREATE OR REPLACE FUNCTION public.inv_consume_reservation(
  p_reservation uuid, p_actor uuid, p_correlation text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res public.inv_reservations%ROWTYPE;
  v_alloc jsonb;
  v_batch public.inv_stock_batches%ROWTYPE;
  v_qty numeric;
BEGIN
  SELECT * INTO v_res FROM public.inv_reservations WHERE id = p_reservation FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'reservation % not found', p_reservation; END IF;
  IF v_res.status <> 'active' THEN RAISE EXCEPTION 'reservation not active (status=%)', v_res.status; END IF;

  FOR v_alloc IN SELECT * FROM jsonb_array_elements(v_res.allocations) LOOP
    v_qty := (v_alloc->>'qty')::numeric;
    SELECT * INTO v_batch FROM public.inv_stock_batches WHERE id = (v_alloc->>'batch_id')::uuid FOR UPDATE;

    UPDATE public.inv_stock_batches
      SET qty_on_hand  = qty_on_hand  - v_qty,
          qty_reserved = GREATEST(0, qty_reserved - v_qty),
          updated_at   = now()
    WHERE id = v_batch.id;

    INSERT INTO public.inv_stock_movements (
      organization_id, warehouse_id, batch_id, product_id,
      movement_type, qty_delta, actor_user_id, reason, ref_type, ref_id, metadata
    ) VALUES (
      v_batch.organization_id, v_batch.warehouse_id, v_batch.id, v_batch.product_id,
      'STOCK_SOLD', -v_qty, p_actor, 'consumption',
      'reservation', p_reservation,
      jsonb_build_object('correlation_id', p_correlation)
    );
  END LOOP;

  UPDATE public.inv_reservations
    SET status = 'consumed', consumed_at = now(), updated_at = now()
  WHERE id = p_reservation;

  PERFORM public.inv_emit('StockConsumed',
    jsonb_build_object('reservation_id', p_reservation, 'product_id', v_res.product_id, 'qty', v_res.qty),
    p_correlation);
END $$;

REVOKE ALL ON FUNCTION public.inv_consume_reservation(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inv_consume_reservation(uuid,uuid,text) TO authenticated, service_role;

-- ---------- inv_transfer_stock (FEFO source, merged destination) ----------
CREATE OR REPLACE FUNCTION public.inv_transfer_stock(
  p_org uuid, p_from_warehouse uuid, p_to_warehouse uuid,
  p_product uuid, p_qty numeric,
  p_actor uuid, p_correlation text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining numeric := p_qty;
  v_batch record;
  v_take numeric;
  v_dest_batch uuid;
  v_transfer_id uuid := gen_random_uuid();
BEGIN
  IF p_qty <= 0 THEN RAISE EXCEPTION 'qty must be positive'; END IF;
  IF p_from_warehouse = p_to_warehouse THEN RAISE EXCEPTION 'source and destination warehouses must differ'; END IF;

  FOR v_batch IN
    SELECT id, qty_on_hand, qty_reserved, expiry_date, batch_no, cost, supplier_id
    FROM public.inv_stock_batches
    WHERE organization_id = p_org AND warehouse_id = p_from_warehouse AND product_id = p_product
      AND (expiry_date IS NULL OR expiry_date > CURRENT_DATE)
      AND qty_on_hand > qty_reserved
    ORDER BY expiry_date NULLS LAST, received_at
    FOR UPDATE SKIP LOCKED
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(v_remaining, v_batch.qty_on_hand - v_batch.qty_reserved);
    IF v_take <= 0 THEN CONTINUE; END IF;

    UPDATE public.inv_stock_batches
      SET qty_on_hand = qty_on_hand - v_take, updated_at = now()
    WHERE id = v_batch.id;

    INSERT INTO public.inv_stock_movements (
      organization_id, warehouse_id, batch_id, product_id,
      movement_type, qty_delta, actor_user_id, reason, ref_type, ref_id, metadata
    ) VALUES (
      p_org, p_from_warehouse, v_batch.id, p_product,
      'STOCK_TRANSFERRED_OUT', -v_take, p_actor, 'transfer',
      'transfer', v_transfer_id,
      jsonb_build_object('correlation_id', p_correlation, 'to_warehouse', p_to_warehouse)
    );

    INSERT INTO public.inv_stock_batches (
      organization_id, warehouse_id, product_id, supplier_id,
      batch_no, expiry_date, qty_on_hand, cost, received_at
    ) VALUES (
      p_org, p_to_warehouse, p_product, v_batch.supplier_id,
      v_batch.batch_no, v_batch.expiry_date, v_take, v_batch.cost, now()
    )
    ON CONFLICT (warehouse_id, product_id, COALESCE(batch_no,''), COALESCE(expiry_date,'infinity'::date))
    DO UPDATE SET qty_on_hand = inv_stock_batches.qty_on_hand + EXCLUDED.qty_on_hand, updated_at = now()
    RETURNING id INTO v_dest_batch;

    INSERT INTO public.inv_stock_movements (
      organization_id, warehouse_id, batch_id, product_id,
      movement_type, qty_delta, actor_user_id, reason, ref_type, ref_id, metadata
    ) VALUES (
      p_org, p_to_warehouse, v_dest_batch, p_product,
      'STOCK_TRANSFERRED_IN', v_take, p_actor, 'transfer',
      'transfer', v_transfer_id,
      jsonb_build_object('correlation_id', p_correlation, 'from_warehouse', p_from_warehouse)
    );

    v_remaining := v_remaining - v_take;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'insufficient stock for transfer: short by %', v_remaining;
  END IF;

  PERFORM public.inv_emit('StockTransferred',
    jsonb_build_object('transfer_id', v_transfer_id, 'product_id', p_product, 'qty', p_qty,
                       'from', p_from_warehouse, 'to', p_to_warehouse),
    p_correlation);
  RETURN v_transfer_id;
END $$;

REVOKE ALL ON FUNCTION public.inv_transfer_stock(uuid,uuid,uuid,uuid,numeric,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inv_transfer_stock(uuid,uuid,uuid,uuid,numeric,uuid,text) TO authenticated, service_role;

-- ---------- inv_return_stock (mirror of receipt) ----------
CREATE OR REPLACE FUNCTION public.inv_return_stock(
  p_org uuid, p_warehouse uuid, p_product uuid,
  p_qty numeric, p_reason text,
  p_actor uuid, p_correlation text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_batch_id uuid;
BEGIN
  IF p_qty <= 0 THEN RAISE EXCEPTION 'qty must be positive'; END IF;

  INSERT INTO public.inv_stock_batches (
    organization_id, warehouse_id, product_id,
    batch_no, qty_on_hand, received_at
  ) VALUES (p_org, p_warehouse, p_product, 'RETURN', p_qty, now())
  ON CONFLICT (warehouse_id, product_id, COALESCE(batch_no,''), COALESCE(expiry_date,'infinity'::date))
  DO UPDATE SET qty_on_hand = inv_stock_batches.qty_on_hand + EXCLUDED.qty_on_hand, updated_at = now()
  RETURNING id INTO v_batch_id;

  INSERT INTO public.inv_stock_movements (
    organization_id, warehouse_id, batch_id, product_id,
    movement_type, qty_delta, actor_user_id, reason, metadata
  ) VALUES (
    p_org, p_warehouse, v_batch_id, p_product,
    'STOCK_RECEIVED', p_qty, p_actor, COALESCE(p_reason,'return'),
    jsonb_build_object('correlation_id', p_correlation, 'kind','return')
  );

  PERFORM public.inv_emit('StockReturned',
    jsonb_build_object('batch_id', v_batch_id, 'product_id', p_product, 'qty', p_qty),
    p_correlation);
  RETURN v_batch_id;
END $$;

REVOKE ALL ON FUNCTION public.inv_return_stock(uuid,uuid,uuid,numeric,text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inv_return_stock(uuid,uuid,uuid,numeric,text,uuid,text) TO authenticated, service_role;

-- ---------- po_receive ----------
CREATE OR REPLACE FUNCTION public.po_receive(
  p_po uuid, p_actor uuid, p_correlation text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po public.purchase_orders%ROWTYPE;
  v_line public.purchase_order_lines%ROWTYPE;
  v_remaining numeric;
BEGIN
  SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PO % not found', p_po; END IF;
  IF v_po.status <> 'approved' THEN RAISE EXCEPTION 'PO must be approved before receiving (status=%)', v_po.status; END IF;

  FOR v_line IN SELECT * FROM public.purchase_order_lines WHERE po_id = p_po LOOP
    v_remaining := v_line.qty_ordered - v_line.qty_received;
    IF v_remaining > 0 THEN
      PERFORM public.inv_receive_stock(
        v_po.organization_id, v_po.warehouse_id, v_line.product_id, v_po.supplier_id,
        v_remaining, v_line.unit_cost, v_line.batch_no, v_line.expiry_date,
        p_actor, p_correlation
      );
      UPDATE public.purchase_order_lines SET qty_received = qty_ordered, updated_at = now() WHERE id = v_line.id;
    END IF;
  END LOOP;

  UPDATE public.purchase_orders
    SET status = 'received', received_at = now(), updated_at = now()
  WHERE id = p_po;

  PERFORM public.inv_emit('PurchaseOrderReceived',
    jsonb_build_object('po_id', p_po, 'supplier_id', v_po.supplier_id, 'warehouse_id', v_po.warehouse_id),
    p_correlation);
END $$;

REVOKE ALL ON FUNCTION public.po_receive(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.po_receive(uuid,uuid,text) TO authenticated, service_role;
