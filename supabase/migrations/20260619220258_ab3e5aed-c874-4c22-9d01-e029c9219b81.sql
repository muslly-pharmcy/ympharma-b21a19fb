
-- =====================================================================
-- WEEK-1 FOUNDATION: Inventory + Discount Engine + Alerts
-- =====================================================================

-- ---------- PHASE 1: INVENTORY ----------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_qty       integer  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reorder_point   integer  NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS expiry_date     date,
  ADD COLUMN IF NOT EXISTS supplier_name   text,
  ADD COLUMN IF NOT EXISTS supplier_cost   numeric(12,2),
  ADD COLUMN IF NOT EXISTS track_stock     boolean  NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_low_stock
  ON public.products (legacy_id)
  WHERE track_stock AND stock_qty <= reorder_point;

CREATE INDEX IF NOT EXISTS idx_products_near_expiry
  ON public.products (expiry_date)
  WHERE expiry_date IS NOT NULL;

-- ---------- PHASE 3: DISCOUNT CODES -----------------------------------
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,
  kind            text NOT NULL CHECK (kind IN ('percent','flat','free_shipping')),
  value           numeric(12,2) NOT NULL DEFAULT 0,
  min_total       numeric(12,2) NOT NULL DEFAULT 0,
  max_uses        integer,
  uses            integer NOT NULL DEFAULT 0,
  first_order_only boolean NOT NULL DEFAULT false,
  starts_at       timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid
);
GRANT SELECT ON public.discount_codes TO authenticated;
GRANT ALL    ON public.discount_codes TO service_role;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage discount codes" ON public.discount_codes;
CREATE POLICY "admins manage discount codes"
  ON public.discount_codes FOR ALL TO authenticated
  USING      (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.discount_redemptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id       uuid NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
  order_id      text NOT NULL,
  customer_phone text NOT NULL,
  amount_off    numeric(12,2) NOT NULL DEFAULT 0,
  redeemed_at   timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.discount_redemptions TO authenticated;
GRANT ALL    ON public.discount_redemptions TO service_role;
ALTER TABLE public.discount_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read redemptions" ON public.discount_redemptions;
CREATE POLICY "admins read redemptions"
  ON public.discount_redemptions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

-- Add discount columns to orders (nullable, backward-compatible)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_code   text,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal        numeric(12,2);

-- ---------- PHASE 2: STAFF ALERTS LOG ---------------------------------
CREATE TABLE IF NOT EXISTS public.staff_alerts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         text NOT NULL,           -- 'new_order' | 'new_rx' | 'low_stock' | 'near_expiry'
  severity     text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warn','critical')),
  title        text NOT NULL,
  body         text,
  entity_type  text,
  entity_id    text,
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  channels     text[] NOT NULL DEFAULT ARRAY['dashboard']::text[],
  whatsapp_status text DEFAULT 'pending', -- pending|sent|failed|skipped
  whatsapp_attempts int NOT NULL DEFAULT 0,
  whatsapp_last_error text,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staff_alerts_unacked
  ON public.staff_alerts (created_at DESC) WHERE acknowledged_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_staff_alerts_wa_pending
  ON public.staff_alerts (created_at) WHERE whatsapp_status = 'pending';

GRANT SELECT, UPDATE ON public.staff_alerts TO authenticated;
GRANT ALL ON public.staff_alerts TO service_role;
ALTER TABLE public.staff_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read alerts" ON public.staff_alerts;
CREATE POLICY "staff read alerts"
  ON public.staff_alerts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner')
      OR public.has_role(auth.uid(),'admin')
      OR public.has_permission(auth.uid(),'orders')
      OR public.has_permission(auth.uid(),'prescriptions'));

DROP POLICY IF EXISTS "staff ack alerts" ON public.staff_alerts;
CREATE POLICY "staff ack alerts"
  ON public.staff_alerts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'owner')
      OR public.has_role(auth.uid(),'admin')
      OR public.has_permission(auth.uid(),'orders')
      OR public.has_permission(auth.uid(),'prescriptions'))
  WITH CHECK (true);

-- ---------- TRIGGERS: auto-create alerts on new orders / rx ----------
CREATE OR REPLACE FUNCTION public.on_order_inserted_alert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.staff_alerts(kind, severity, title, body, entity_type, entity_id, payload, channels)
  VALUES ('new_order', 'info',
          'طلب جديد ' || NEW.id,
          NEW.customer_name || ' — ' || COALESCE(NEW.total::text,'0') || ' ر.ي',
          'order', NEW.id,
          jsonb_build_object('total', NEW.total, 'phone', NEW.customer_phone),
          ARRAY['dashboard','whatsapp']);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_order_new_alert ON public.orders;
CREATE TRIGGER trg_order_new_alert
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.on_order_inserted_alert();

CREATE OR REPLACE FUNCTION public.on_rx_inserted_alert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.staff_alerts(kind, severity, title, body, entity_type, entity_id, payload, channels)
  VALUES ('new_rx', 'warn',
          'روشتة جديدة ' || NEW.id,
          NEW.customer_name || ' — ' || COALESCE(array_length(NEW.image_urls,1),0)::text || ' صورة',
          'prescription', NEW.id,
          jsonb_build_object('phone', NEW.customer_phone),
          ARRAY['dashboard','whatsapp']);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_rx_new_alert ON public.prescriptions;
CREATE TRIGGER trg_rx_new_alert
  AFTER INSERT ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.on_rx_inserted_alert();

-- ---------- RPC: validate_discount (read-only preview for cart UI) ---
CREATE OR REPLACE FUNCTION public.validate_discount(_code text, _subtotal numeric, _customer_phone text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.discount_codes;
  v_amount_off numeric := 0;
  v_first_order_violated boolean := false;
BEGIN
  IF _code IS NULL OR length(trim(_code))=0 THEN
    RETURN jsonb_build_object('ok',false,'error','empty');
  END IF;
  SELECT * INTO c FROM public.discount_codes WHERE upper(code) = upper(trim(_code));
  IF c IS NULL OR NOT c.active THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
  IF c.starts_at > now() THEN RETURN jsonb_build_object('ok',false,'error','not_started'); END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN RETURN jsonb_build_object('ok',false,'error','expired'); END IF;
  IF c.max_uses IS NOT NULL AND c.uses >= c.max_uses THEN RETURN jsonb_build_object('ok',false,'error','exhausted'); END IF;
  IF _subtotal < c.min_total THEN
    RETURN jsonb_build_object('ok',false,'error','min_total','min_total',c.min_total);
  END IF;
  IF c.first_order_only AND _customer_phone IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.orders WHERE customer_phone = _customer_phone AND status <> 'cancelled') THEN
      RETURN jsonb_build_object('ok',false,'error','first_order_only');
    END IF;
  END IF;
  IF c.kind = 'percent' THEN
    v_amount_off := round(_subtotal * (c.value / 100.0), 2);
  ELSIF c.kind = 'flat' THEN
    v_amount_off := least(c.value, _subtotal);
  ELSIF c.kind = 'free_shipping' THEN
    v_amount_off := 0; -- shipping handled outside subtotal
  END IF;
  RETURN jsonb_build_object('ok',true,'code',c.code,'kind',c.kind,'amount_off',v_amount_off);
END; $$;
GRANT EXECUTE ON FUNCTION public.validate_discount(text,numeric,text) TO anon, authenticated;

-- ---------- RPC: place_order v2 — stock check + discount apply -------
CREATE OR REPLACE FUNCTION public.place_order(_id text, _customer jsonb, _items jsonb, _discount_code text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text := trim(coalesce(_customer->>'name',''));
  v_phone text := trim(coalesce(_customer->>'phone',''));
  v_address text := trim(coalesce(_customer->>'address',''));
  v_notes text := nullif(trim(coalesce(_customer->>'notes','')), '');
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_discount_amount numeric := 0;
  v_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_legacy_id int;
  v_qty int;
  v_price numeric;
  v_pname text;
  v_published boolean;
  v_stock int;
  v_track boolean;
  v_disc jsonb;
  v_code_id uuid;
BEGIN
  -- Idempotency
  IF EXISTS (SELECT 1 FROM public.orders WHERE id = _id) THEN
    RETURN jsonb_build_object('ok', true, 'id', _id, 'idempotent', true);
  END IF;

  IF _id IS NULL OR length(_id) < 4 OR length(_id) > 64 OR _id !~ '^[A-Za-z0-9_-]+$' THEN RAISE EXCEPTION 'invalid_id'; END IF;
  IF length(v_name) < 2 OR length(v_name) > 120 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  IF length(v_phone) < 6 OR length(v_phone) > 30 THEN RAISE EXCEPTION 'invalid_phone'; END IF;
  IF length(v_address) < 3 OR length(v_address) > 500 THEN RAISE EXCEPTION 'invalid_address'; END IF;
  IF v_notes IS NOT NULL AND length(v_notes) > 1000 THEN RAISE EXCEPTION 'invalid_notes'; END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 OR jsonb_array_length(_items) > 100 THEN
    RAISE EXCEPTION 'invalid_items';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_legacy_id := NULLIF(v_item->>'id','')::int;
    v_qty := NULLIF(v_item->>'qty','')::int;
    IF v_legacy_id IS NULL OR v_qty IS NULL OR v_qty < 1 OR v_qty > 999 THEN RAISE EXCEPTION 'invalid_item'; END IF;
    SELECT p.name, p.price, p.is_published, p.stock_qty, p.track_stock
      INTO v_pname, v_price, v_published, v_stock, v_track
      FROM public.products p WHERE p.legacy_id = v_legacy_id
      FOR UPDATE;
    IF v_price IS NULL THEN RAISE EXCEPTION 'unknown_product:%', v_legacy_id; END IF;
    IF NOT v_published THEN RAISE EXCEPTION 'unpublished_product:%', v_legacy_id; END IF;
    IF v_track AND v_stock < v_qty THEN RAISE EXCEPTION 'insufficient_stock:%:%', v_legacy_id, v_stock; END IF;
    IF v_track THEN
      UPDATE public.products SET stock_qty = stock_qty - v_qty WHERE legacy_id = v_legacy_id;
      -- low-stock alert
      IF (v_stock - v_qty) <= (SELECT reorder_point FROM public.products WHERE legacy_id = v_legacy_id) THEN
        INSERT INTO public.staff_alerts(kind, severity, title, body, entity_type, entity_id, payload, channels)
        VALUES ('low_stock','warn',
                'مخزون منخفض: ' || v_pname,
                'تبقى ' || (v_stock - v_qty)::text || ' وحدة',
                'product', v_legacy_id::text,
                jsonb_build_object('legacy_id', v_legacy_id, 'remaining', v_stock - v_qty),
                ARRAY['dashboard','whatsapp']);
      END IF;
    END IF;
    v_items := v_items || jsonb_build_array(jsonb_build_object('id', v_legacy_id, 'qty', v_qty, 'name', v_pname, 'price', v_price));
    v_subtotal := v_subtotal + (v_price * v_qty);
  END LOOP;

  v_total := v_subtotal;

  -- Discount
  IF _discount_code IS NOT NULL AND length(trim(_discount_code)) > 0 THEN
    v_disc := public.validate_discount(_discount_code, v_subtotal, v_phone);
    IF (v_disc->>'ok')::boolean THEN
      v_discount_amount := COALESCE((v_disc->>'amount_off')::numeric, 0);
      v_total := GREATEST(0, v_subtotal - v_discount_amount);
      SELECT id INTO v_code_id FROM public.discount_codes WHERE upper(code) = upper(trim(_discount_code));
      UPDATE public.discount_codes SET uses = uses + 1 WHERE id = v_code_id;
    END IF;
  END IF;

  IF v_total <= 0 OR v_total > 10000000 THEN RAISE EXCEPTION 'invalid_total:%', v_total; END IF;

  INSERT INTO public.orders(id, customer_name, customer_phone, customer_address, notes, total, subtotal, discount_code, discount_amount, status, items)
  VALUES (_id, v_name, v_phone, v_address, v_notes, v_total, v_subtotal, NULLIF(trim(coalesce(_discount_code,'')),''), v_discount_amount, 'pending', v_items);

  IF v_code_id IS NOT NULL THEN
    INSERT INTO public.discount_redemptions(code_id, order_id, customer_phone, amount_off)
    VALUES (v_code_id, _id, v_phone, v_discount_amount);
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', _id, 'subtotal', v_subtotal, 'discount_amount', v_discount_amount, 'total', v_total, 'items', v_items);
END; $$;
GRANT EXECUTE ON FUNCTION public.place_order(text,jsonb,jsonb,text) TO anon, authenticated;

-- ---------- RPC: inventory dashboards --------------------------------
CREATE OR REPLACE FUNCTION public.inventory_report()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_low jsonb; v_expiring jsonb; v_oos jsonb; v_value numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'orders')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT COALESCE(jsonb_agg(t), '[]') INTO v_low FROM (
    SELECT legacy_id, name, stock_qty, reorder_point, supplier_name
    FROM public.products
    WHERE track_stock AND stock_qty <= reorder_point
    ORDER BY stock_qty ASC LIMIT 50
  ) t;
  SELECT COALESCE(jsonb_agg(t), '[]') INTO v_expiring FROM (
    SELECT legacy_id, name, expiry_date, stock_qty
    FROM public.products
    WHERE expiry_date IS NOT NULL AND expiry_date <= (now() + interval '90 days')::date
    ORDER BY expiry_date ASC LIMIT 50
  ) t;
  SELECT COALESCE(jsonb_agg(t), '[]') INTO v_oos FROM (
    SELECT legacy_id, name FROM public.products
    WHERE track_stock AND stock_qty = 0 ORDER BY name LIMIT 100
  ) t;
  SELECT COALESCE(SUM(stock_qty * COALESCE(supplier_cost, price)), 0) INTO v_value FROM public.products WHERE track_stock;
  RETURN jsonb_build_object(
    'low_stock', v_low,
    'near_expiry', v_expiring,
    'out_of_stock', v_oos,
    'inventory_value', v_value,
    'checked_at', now()
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.inventory_report() TO authenticated;

-- ---------- RPC: ack alert --------------------------------------------
CREATE OR REPLACE FUNCTION public.ack_staff_alert(_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.staff_alerts
    SET acknowledged_at = now(), acknowledged_by = auth.uid()
    WHERE id = _id AND acknowledged_at IS NULL;
  RETURN FOUND;
END; $$;
GRANT EXECUTE ON FUNCTION public.ack_staff_alert(uuid) TO authenticated;
