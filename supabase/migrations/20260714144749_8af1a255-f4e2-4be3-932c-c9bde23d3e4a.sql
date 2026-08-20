-- Phoenix Phase 5 — Inventory / Warehouse / Suppliers foundation (retry)
CREATE TYPE public.wh_kind AS ENUM ('central','branch','virtual','transit');
CREATE TYPE public.inv_movement_type AS ENUM (
  'STOCK_RECEIVED','STOCK_TRANSFERRED_OUT','STOCK_TRANSFERRED_IN',
  'STOCK_SOLD','STOCK_ADJUSTED','STOCK_EXPIRED','STOCK_RESERVED','STOCK_RELEASED'
);
CREATE TYPE public.inv_transfer_status AS ENUM (
  'draft','approved','reserved','picked','packed','dispatched','received','cancelled'
);
CREATE TYPE public.sup_status AS ENUM ('active','inactive','suspended');
CREATE TYPE public.inv_expiry_tier AS ENUM ('NEAR_90','NEAR_60','NEAR_30','EXPIRED');

CREATE TABLE public.wh_warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  code TEXT NOT NULL, name TEXT NOT NULL,
  kind public.wh_kind NOT NULL DEFAULT 'central',
  address TEXT, is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wh_warehouses TO authenticated;
GRANT ALL ON public.wh_warehouses TO service_role;
ALTER TABLE public.wh_warehouses ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.wh_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES public.wh_warehouses(id) ON DELETE CASCADE,
  code TEXT NOT NULL, label TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (warehouse_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wh_locations TO authenticated;
GRANT ALL ON public.wh_locations TO service_role;
ALTER TABLE public.wh_locations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sup_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code TEXT, name TEXT NOT NULL, legal_name TEXT, tax_id TEXT,
  contact JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.sup_status NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sup_suppliers TO authenticated;
GRANT ALL ON public.sup_suppliers TO service_role;
ALTER TABLE public.sup_suppliers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sup_supplier_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.sup_suppliers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  supplier_sku TEXT, default_cost NUMERIC(14,4),
  lead_time_days INT, min_order_qty INT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sup_supplier_products TO authenticated;
GRANT ALL ON public.sup_supplier_products TO service_role;
ALTER TABLE public.sup_supplier_products ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.inv_stock_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.wh_warehouses(id) ON DELETE RESTRICT,
  location_id UUID REFERENCES public.wh_locations(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES public.catalog_products(id) ON DELETE RESTRICT,
  supplier_id UUID REFERENCES public.sup_suppliers(id) ON DELETE SET NULL,
  batch_no TEXT, expiry_date DATE,
  qty_on_hand NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (qty_on_hand >= 0),
  qty_reserved NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (qty_reserved >= 0),
  cost NUMERIC(14,4), selling_price NUMERIC(14,4),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX inv_stock_batches_uniq
  ON public.inv_stock_batches (warehouse_id, product_id, COALESCE(batch_no,''), COALESCE(expiry_date,'infinity'::date));
CREATE INDEX inv_stock_batches_org_idx ON public.inv_stock_batches (organization_id);
CREATE INDEX inv_stock_batches_expiry_idx ON public.inv_stock_batches (expiry_date) WHERE expiry_date IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inv_stock_batches TO authenticated;
GRANT ALL ON public.inv_stock_batches TO service_role;
ALTER TABLE public.inv_stock_batches ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.inv_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.wh_warehouses(id) ON DELETE RESTRICT,
  batch_id UUID REFERENCES public.inv_stock_batches(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES public.catalog_products(id) ON DELETE RESTRICT,
  movement_type public.inv_movement_type NOT NULL,
  qty_delta NUMERIC(14,3) NOT NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT, ref_type TEXT, ref_id UUID,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX inv_stock_movements_batch_idx ON public.inv_stock_movements (batch_id);
CREATE INDEX inv_stock_movements_product_idx ON public.inv_stock_movements (product_id);
CREATE INDEX inv_stock_movements_org_time_idx ON public.inv_stock_movements (organization_id, occurred_at DESC);
GRANT SELECT ON public.inv_stock_movements TO authenticated;
GRANT ALL ON public.inv_stock_movements TO service_role;
ALTER TABLE public.inv_stock_movements ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.inv_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code TEXT,
  source_warehouse_id UUID NOT NULL REFERENCES public.wh_warehouses(id) ON DELETE RESTRICT,
  dest_warehouse_id UUID NOT NULL REFERENCES public.wh_warehouses(id) ON DELETE RESTRICT,
  status public.inv_transfer_status NOT NULL DEFAULT 'draft',
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dispatched_at TIMESTAMPTZ, received_at TIMESTAMPTZ, cancelled_at TIMESTAMPTZ,
  notes TEXT, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (source_warehouse_id <> dest_warehouse_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inv_transfers TO authenticated;
GRANT ALL ON public.inv_transfers TO service_role;
ALTER TABLE public.inv_transfers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.inv_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES public.inv_transfers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.catalog_products(id) ON DELETE RESTRICT,
  batch_id UUID REFERENCES public.inv_stock_batches(id) ON DELETE SET NULL,
  qty_requested NUMERIC(14,3) NOT NULL CHECK (qty_requested > 0),
  qty_reserved NUMERIC(14,3) NOT NULL DEFAULT 0,
  qty_picked NUMERIC(14,3) NOT NULL DEFAULT 0,
  qty_received NUMERIC(14,3) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX inv_transfer_items_xfer_idx ON public.inv_transfer_items (transfer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inv_transfer_items TO authenticated;
GRANT ALL ON public.inv_transfer_items TO service_role;
ALTER TABLE public.inv_transfer_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.inv_expiry_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.inv_stock_batches(id) ON DELETE CASCADE,
  tier public.inv_expiry_tier NOT NULL,
  qty_at_alert NUMERIC(14,3) NOT NULL DEFAULT 0,
  expiry_date DATE,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, tier)
);
GRANT SELECT, UPDATE ON public.inv_expiry_alerts TO authenticated;
GRANT ALL ON public.inv_expiry_alerts TO service_role;
ALTER TABLE public.inv_expiry_alerts ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['wh_warehouses','wh_locations','sup_suppliers','sup_supplier_products','inv_stock_batches','inv_transfers','inv_transfer_items'] LOOP
    EXECUTE format('CREATE TRIGGER trg_%1$s_updated BEFORE UPDATE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;

CREATE POLICY "wh_warehouses_read" ON public.wh_warehouses FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "wh_warehouses_write" ON public.wh_warehouses FOR ALL TO authenticated
  USING (public.has_org_permission(auth.uid(), organization_id, 'warehouses.manage'))
  WITH CHECK (public.has_org_permission(auth.uid(), organization_id, 'warehouses.manage'));
CREATE POLICY "wh_locations_read" ON public.wh_locations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.wh_warehouses w WHERE w.id = warehouse_id AND public.is_org_member(w.organization_id, auth.uid())));
CREATE POLICY "wh_locations_write" ON public.wh_locations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.wh_warehouses w WHERE w.id = warehouse_id AND public.has_org_permission(auth.uid(), w.organization_id, 'warehouses.manage')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.wh_warehouses w WHERE w.id = warehouse_id AND public.has_org_permission(auth.uid(), w.organization_id, 'warehouses.manage')));
CREATE POLICY "sup_suppliers_read" ON public.sup_suppliers FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "sup_suppliers_write" ON public.sup_suppliers FOR ALL TO authenticated
  USING (public.has_org_permission(auth.uid(), organization_id, 'suppliers.manage'))
  WITH CHECK (public.has_org_permission(auth.uid(), organization_id, 'suppliers.manage'));
CREATE POLICY "sup_supplier_products_read" ON public.sup_supplier_products FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sup_suppliers s WHERE s.id = supplier_id AND public.is_org_member(s.organization_id, auth.uid())));
CREATE POLICY "sup_supplier_products_write" ON public.sup_supplier_products FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sup_suppliers s WHERE s.id = supplier_id AND public.has_org_permission(auth.uid(), s.organization_id, 'suppliers.manage')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sup_suppliers s WHERE s.id = supplier_id AND public.has_org_permission(auth.uid(), s.organization_id, 'suppliers.manage')));
CREATE POLICY "inv_stock_batches_read" ON public.inv_stock_batches FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "inv_stock_batches_write" ON public.inv_stock_batches FOR ALL TO authenticated
  USING (public.has_org_permission(auth.uid(), organization_id, 'inventory.write'))
  WITH CHECK (public.has_org_permission(auth.uid(), organization_id, 'inventory.write'));
CREATE POLICY "inv_stock_movements_read" ON public.inv_stock_movements FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "inv_transfers_read" ON public.inv_transfers FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "inv_transfers_write" ON public.inv_transfers FOR ALL TO authenticated
  USING (public.has_org_permission(auth.uid(), organization_id, 'transfers.manage'))
  WITH CHECK (public.has_org_permission(auth.uid(), organization_id, 'transfers.manage'));
CREATE POLICY "inv_transfer_items_read" ON public.inv_transfer_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.inv_transfers t WHERE t.id = transfer_id AND public.is_org_member(t.organization_id, auth.uid())));
CREATE POLICY "inv_transfer_items_write" ON public.inv_transfer_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.inv_transfers t WHERE t.id = transfer_id AND public.has_org_permission(auth.uid(), t.organization_id, 'transfers.manage')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.inv_transfers t WHERE t.id = transfer_id AND public.has_org_permission(auth.uid(), t.organization_id, 'transfers.manage')));
CREATE POLICY "inv_expiry_alerts_read" ON public.inv_expiry_alerts FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "inv_expiry_alerts_ack" ON public.inv_expiry_alerts FOR UPDATE TO authenticated
  USING (public.has_org_permission(auth.uid(), organization_id, 'inventory.read'))
  WITH CHECK (public.has_org_permission(auth.uid(), organization_id, 'inventory.read'));

INSERT INTO public.permissions (key, resource, action, description) VALUES
  ('inventory.read','inventory','read','View inventory batches and movements'),
  ('inventory.write','inventory','write','Adjust stock and receive inventory'),
  ('transfers.read','transfers','read','View stock transfers'),
  ('transfers.manage','transfers','manage','Create and progress stock transfers'),
  ('suppliers.read','suppliers','read','View suppliers'),
  ('suppliers.manage','suppliers','manage','Create and edit suppliers'),
  ('warehouses.manage','warehouses','manage','Create and edit warehouses')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_key)
SELECT v.r::public.org_role, v.k FROM (VALUES
  ('owner','inventory.read'),('owner','inventory.write'),
  ('owner','transfers.read'),('owner','transfers.manage'),
  ('owner','suppliers.read'),('owner','suppliers.manage'),
  ('owner','warehouses.manage'),
  ('admin','inventory.read'),('admin','inventory.write'),
  ('admin','transfers.read'),('admin','transfers.manage'),
  ('admin','suppliers.read'),('admin','suppliers.manage'),
  ('admin','warehouses.manage'),
  ('manager','inventory.read'),('manager','inventory.write'),
  ('manager','transfers.read'),('manager','transfers.manage'),
  ('manager','suppliers.read'),('manager','suppliers.manage'),
  ('pharmacist','inventory.read'),('pharmacist','inventory.write'),
  ('employee','inventory.read')
) AS v(r,k)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.inv_emit_event(_event TEXT, _org UUID, _entity_type TEXT, _entity_id UUID, _payload JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.agent_events (event_name, entity_type, entity_id, payload)
  VALUES (_event, _entity_type, _entity_id, COALESCE(_payload,'{}'::jsonb) || jsonb_build_object('organization_id', _org));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
REVOKE ALL ON FUNCTION public.inv_emit_event(TEXT,UUID,TEXT,UUID,JSONB) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.inv_receive_stock(
  _org UUID, _warehouse UUID, _product UUID, _qty NUMERIC,
  _batch_no TEXT DEFAULT NULL, _expiry DATE DEFAULT NULL,
  _cost NUMERIC DEFAULT NULL, _supplier UUID DEFAULT NULL, _reason TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _batch_id UUID; _actor UUID := auth.uid();
BEGIN
  IF NOT public.has_org_permission(auth.uid(), _org, 'inventory.write') THEN
    RAISE EXCEPTION 'forbidden: inventory.write required'; END IF;
  IF _qty <= 0 THEN RAISE EXCEPTION 'qty must be > 0'; END IF;
  INSERT INTO public.inv_stock_batches (organization_id, warehouse_id, product_id, supplier_id, batch_no, expiry_date, qty_on_hand, cost)
  VALUES (_org, _warehouse, _product, _supplier, _batch_no, _expiry, _qty, _cost)
  ON CONFLICT (warehouse_id, product_id, COALESCE(batch_no,''), COALESCE(expiry_date,'infinity'::date))
  DO UPDATE SET qty_on_hand = public.inv_stock_batches.qty_on_hand + EXCLUDED.qty_on_hand,
                cost = COALESCE(EXCLUDED.cost, public.inv_stock_batches.cost), updated_at = now()
  RETURNING id INTO _batch_id;
  INSERT INTO public.inv_stock_movements (organization_id, warehouse_id, batch_id, product_id, movement_type, qty_delta, actor_user_id, reason)
  VALUES (_org, _warehouse, _batch_id, _product, 'STOCK_RECEIVED', _qty, _actor, _reason);
  PERFORM public.inv_emit_event('STOCK_RECEIVED', _org, 'inv_stock_batch', _batch_id,
    jsonb_build_object('product_id', _product, 'warehouse_id', _warehouse, 'qty', _qty));
  RETURN _batch_id;
END $$;
REVOKE ALL ON FUNCTION public.inv_receive_stock(UUID,UUID,UUID,NUMERIC,TEXT,DATE,NUMERIC,UUID,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inv_receive_stock(UUID,UUID,UUID,NUMERIC,TEXT,DATE,NUMERIC,UUID,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.inv_adjust_stock(_batch UUID, _qty_delta NUMERIC, _reason TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _b RECORD; _mv UUID; _actor UUID := auth.uid();
BEGIN
  SELECT * INTO _b FROM public.inv_stock_batches WHERE id = _batch;
  IF NOT FOUND THEN RAISE EXCEPTION 'batch not found'; END IF;
  IF NOT public.has_org_permission(auth.uid(), _b.organization_id, 'inventory.write') THEN
    RAISE EXCEPTION 'forbidden'; END IF;
  IF _b.qty_on_hand + _qty_delta < 0 THEN RAISE EXCEPTION 'insufficient stock'; END IF;
  UPDATE public.inv_stock_batches SET qty_on_hand = qty_on_hand + _qty_delta, updated_at = now() WHERE id = _batch;
  INSERT INTO public.inv_stock_movements (organization_id, warehouse_id, batch_id, product_id, movement_type, qty_delta, actor_user_id, reason)
  VALUES (_b.organization_id, _b.warehouse_id, _batch, _b.product_id, 'STOCK_ADJUSTED', _qty_delta, _actor, _reason)
  RETURNING id INTO _mv;
  PERFORM public.inv_emit_event('STOCK_MOVEMENT_CREATED', _b.organization_id, 'inv_stock_movement', _mv,
    jsonb_build_object('batch_id', _batch, 'qty_delta', _qty_delta, 'type', 'STOCK_ADJUSTED'));
  RETURN _mv;
END $$;
REVOKE ALL ON FUNCTION public.inv_adjust_stock(UUID,NUMERIC,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inv_adjust_stock(UUID,NUMERIC,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.inv_reserve_for_transfer(_transfer UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t RECORD; _item RECORD; _b RECORD; _remaining NUMERIC; _take NUMERIC; _count INT := 0;
BEGIN
  SELECT * INTO _t FROM public.inv_transfers WHERE id = _transfer FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transfer not found'; END IF;
  IF NOT public.has_org_permission(auth.uid(), _t.organization_id, 'transfers.manage') THEN
    RAISE EXCEPTION 'forbidden'; END IF;
  IF _t.status NOT IN ('draft','approved') THEN RAISE EXCEPTION 'invalid state: %', _t.status; END IF;
  FOR _item IN SELECT * FROM public.inv_transfer_items WHERE transfer_id = _transfer LOOP
    _remaining := _item.qty_requested - _item.qty_reserved;
    FOR _b IN SELECT * FROM public.inv_stock_batches
              WHERE warehouse_id = _t.source_warehouse_id AND product_id = _item.product_id
                AND (qty_on_hand - qty_reserved) > 0
              ORDER BY COALESCE(expiry_date, 'infinity'::date) ASC, received_at ASC FOR UPDATE
    LOOP
      EXIT WHEN _remaining <= 0;
      _take := LEAST(_remaining, _b.qty_on_hand - _b.qty_reserved);
      UPDATE public.inv_stock_batches SET qty_reserved = qty_reserved + _take, updated_at = now() WHERE id = _b.id;
      INSERT INTO public.inv_stock_movements (organization_id, warehouse_id, batch_id, product_id, movement_type, qty_delta, actor_user_id, reason, ref_type, ref_id)
      VALUES (_t.organization_id, _t.source_warehouse_id, _b.id, _item.product_id, 'STOCK_RESERVED', _take, auth.uid(), 'transfer_reserve', 'inv_transfer', _transfer);
      _remaining := _remaining - _take; _count := _count + 1;
    END LOOP;
    UPDATE public.inv_transfer_items SET qty_reserved = _item.qty_requested - _remaining, updated_at = now() WHERE id = _item.id;
  END LOOP;
  UPDATE public.inv_transfers SET status = 'reserved', updated_at = now() WHERE id = _transfer;
  PERFORM public.inv_emit_event('TRANSFER_CREATED', _t.organization_id, 'inv_transfer', _transfer, jsonb_build_object('status','reserved'));
  RETURN _count;
END $$;
REVOKE ALL ON FUNCTION public.inv_reserve_for_transfer(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inv_reserve_for_transfer(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.inv_dispatch_transfer(_transfer UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t RECORD; _item RECORD; _b RECORD; _remaining NUMERIC; _take NUMERIC;
BEGIN
  SELECT * INTO _t FROM public.inv_transfers WHERE id = _transfer FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transfer not found'; END IF;
  IF NOT public.has_org_permission(auth.uid(), _t.organization_id, 'transfers.manage') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _t.status NOT IN ('reserved','picked','packed') THEN RAISE EXCEPTION 'invalid state: %', _t.status; END IF;
  FOR _item IN SELECT * FROM public.inv_transfer_items WHERE transfer_id = _transfer LOOP
    _remaining := _item.qty_reserved;
    FOR _b IN SELECT * FROM public.inv_stock_batches
              WHERE warehouse_id = _t.source_warehouse_id AND product_id = _item.product_id AND qty_reserved > 0
              ORDER BY COALESCE(expiry_date, 'infinity'::date) ASC FOR UPDATE
    LOOP
      EXIT WHEN _remaining <= 0;
      _take := LEAST(_remaining, _b.qty_reserved);
      UPDATE public.inv_stock_batches SET qty_on_hand = qty_on_hand - _take, qty_reserved = qty_reserved - _take, updated_at = now() WHERE id = _b.id;
      INSERT INTO public.inv_stock_movements (organization_id, warehouse_id, batch_id, product_id, movement_type, qty_delta, actor_user_id, reason, ref_type, ref_id)
      VALUES (_t.organization_id, _t.source_warehouse_id, _b.id, _item.product_id, 'STOCK_TRANSFERRED_OUT', -_take, auth.uid(), 'transfer_dispatch', 'inv_transfer', _transfer);
      _remaining := _remaining - _take;
    END LOOP;
    UPDATE public.inv_transfer_items SET qty_picked = _item.qty_reserved, updated_at = now() WHERE id = _item.id;
  END LOOP;
  UPDATE public.inv_transfers SET status = 'dispatched', dispatched_at = now(), updated_at = now() WHERE id = _transfer;
END $$;
REVOKE ALL ON FUNCTION public.inv_dispatch_transfer(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inv_dispatch_transfer(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.inv_receive_transfer(_transfer UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t RECORD; _item RECORD; _new_batch UUID;
BEGIN
  SELECT * INTO _t FROM public.inv_transfers WHERE id = _transfer FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transfer not found'; END IF;
  IF NOT public.has_org_permission(auth.uid(), _t.organization_id, 'transfers.manage') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _t.status <> 'dispatched' THEN RAISE EXCEPTION 'invalid state: %', _t.status; END IF;
  FOR _item IN SELECT * FROM public.inv_transfer_items WHERE transfer_id = _transfer LOOP
    IF _item.qty_picked <= 0 THEN CONTINUE; END IF;
    INSERT INTO public.inv_stock_batches (organization_id, warehouse_id, product_id, batch_no, expiry_date, qty_on_hand, metadata)
    VALUES (_t.organization_id, _t.dest_warehouse_id, _item.product_id, NULL, NULL, _item.qty_picked, jsonb_build_object('from_transfer', _transfer))
    ON CONFLICT (warehouse_id, product_id, COALESCE(batch_no,''), COALESCE(expiry_date,'infinity'::date))
    DO UPDATE SET qty_on_hand = public.inv_stock_batches.qty_on_hand + EXCLUDED.qty_on_hand, updated_at = now()
    RETURNING id INTO _new_batch;
    INSERT INTO public.inv_stock_movements (organization_id, warehouse_id, batch_id, product_id, movement_type, qty_delta, actor_user_id, reason, ref_type, ref_id)
    VALUES (_t.organization_id, _t.dest_warehouse_id, _new_batch, _item.product_id, 'STOCK_TRANSFERRED_IN', _item.qty_picked, auth.uid(), 'transfer_receive', 'inv_transfer', _transfer);
    UPDATE public.inv_transfer_items SET qty_received = _item.qty_picked, updated_at = now() WHERE id = _item.id;
  END LOOP;
  UPDATE public.inv_transfers SET status = 'received', received_at = now(), updated_at = now() WHERE id = _transfer;
  PERFORM public.inv_emit_event('TRANSFER_COMPLETED', _t.organization_id, 'inv_transfer', _transfer, jsonb_build_object('status','received'));
END $$;
REVOKE ALL ON FUNCTION public.inv_receive_transfer(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inv_receive_transfer(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.inv_scan_expiry(_org UUID, _horizon_days INT DEFAULT 90)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _b RECORD; _tier public.inv_expiry_tier; _inserted INT := 0; _alert_id UUID;
BEGIN
  IF NOT public.has_org_permission(auth.uid(), _org, 'inventory.read') THEN RAISE EXCEPTION 'forbidden'; END IF;
  FOR _b IN SELECT * FROM public.inv_stock_batches
            WHERE organization_id = _org AND expiry_date IS NOT NULL AND qty_on_hand > 0
              AND expiry_date <= (current_date + make_interval(days => _horizon_days))
  LOOP
    _tier := CASE
      WHEN _b.expiry_date < current_date THEN 'EXPIRED'
      WHEN _b.expiry_date <= current_date + INTERVAL '30 days' THEN 'NEAR_30'
      WHEN _b.expiry_date <= current_date + INTERVAL '60 days' THEN 'NEAR_60'
      ELSE 'NEAR_90' END::public.inv_expiry_tier;
    INSERT INTO public.inv_expiry_alerts (organization_id, batch_id, tier, qty_at_alert, expiry_date)
    VALUES (_org, _b.id, _tier, _b.qty_on_hand, _b.expiry_date)
    ON CONFLICT (batch_id, tier) DO NOTHING
    RETURNING id INTO _alert_id;
    IF _alert_id IS NOT NULL THEN
      _inserted := _inserted + 1;
      PERFORM public.inv_emit_event('EXPIRY_ALERT_CREATED', _org, 'inv_expiry_alert', _alert_id,
        jsonb_build_object('batch_id', _b.id, 'tier', _tier, 'expiry_date', _b.expiry_date));
    END IF;
  END LOOP;
  RETURN _inserted;
END $$;
REVOKE ALL ON FUNCTION public.inv_scan_expiry(UUID,INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inv_scan_expiry(UUID,INT) TO authenticated;
