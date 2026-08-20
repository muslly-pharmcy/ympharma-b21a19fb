
-- ============================================================
-- Phase 5A: Reconciliation + Shadow Read + Rollback + Readiness
-- READ-ONLY observability layer. No mutation of stock or orders.
-- ============================================================

-- 1) Rollback switch (not yet consumed by checkout)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings read auth" ON public.app_settings;
CREATE POLICY "app_settings read auth"
  ON public.app_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "app_settings admin write" ON public.app_settings;
CREATE POLICY "app_settings admin write"
  ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.app_settings(key, value, description)
VALUES ('inventory_write_mode',
        '"legacy_only"'::jsonb,
        'Phase 5 cutover switch: legacy_only | dual_write | branch_only. Not consumed by checkout until Phase 5B.')
ON CONFLICT (key) DO NOTHING;

-- 2) Shadow read log (SELECT-only consequence of place_order; no writes to inventory)
CREATE TABLE IF NOT EXISTS public.inventory_shadow_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text,
  legacy_id integer,
  product_id uuid,
  requested_qty integer NOT NULL,
  legacy_stock integer,
  branch_id uuid,
  branch_code text,
  branch_stock integer,
  would_succeed boolean NOT NULL,
  shortfall integer,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.inventory_shadow_log TO authenticated;
GRANT ALL ON public.inventory_shadow_log TO service_role;
ALTER TABLE public.inventory_shadow_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shadow log admin read" ON public.inventory_shadow_log;
CREATE POLICY "shadow log admin read"
  ON public.inventory_shadow_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS inventory_shadow_log_order_idx ON public.inventory_shadow_log(order_id);
CREATE INDEX IF NOT EXISTS inventory_shadow_log_created_idx ON public.inventory_shadow_log(created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_shadow_log_mismatch_idx
  ON public.inventory_shadow_log(created_at DESC) WHERE would_succeed = false;

-- 3) Shadow-read helper: called by place_order, SELECT-only.
-- Picks BR-001 as analytical fallback only — does NOT bind orders to branches.
CREATE OR REPLACE FUNCTION public.log_inventory_shadow(
  _order_id text,
  _legacy_id integer,
  _requested_qty integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_prod_id uuid;
  v_legacy_stock integer;
  v_branch_id uuid;
  v_branch_code text := 'BR-001';
  v_branch_stock integer;
  v_would_succeed boolean;
  v_shortfall integer;
BEGIN
  SELECT id, stock_qty INTO v_prod_id, v_legacy_stock
    FROM public.products WHERE legacy_id = _legacy_id;
  IF v_prod_id IS NULL THEN
    INSERT INTO public.inventory_shadow_log(order_id, legacy_id, requested_qty, would_succeed, note)
    VALUES (_order_id, _legacy_id, _requested_qty, false, 'product_not_found');
    RETURN;
  END IF;

  SELECT id INTO v_branch_id FROM public.branches WHERE code = v_branch_code LIMIT 1;

  SELECT qty INTO v_branch_stock
    FROM public.branch_inventory
    WHERE branch_id = v_branch_id AND product_id = v_prod_id;

  v_branch_stock := COALESCE(v_branch_stock, 0);
  v_would_succeed := v_branch_stock >= _requested_qty;
  v_shortfall := GREATEST(0, _requested_qty - v_branch_stock);

  INSERT INTO public.inventory_shadow_log(
    order_id, legacy_id, product_id, requested_qty,
    legacy_stock, branch_id, branch_code, branch_stock,
    would_succeed, shortfall, note
  ) VALUES (
    _order_id, _legacy_id, v_prod_id, _requested_qty,
    v_legacy_stock, v_branch_id, v_branch_code, v_branch_stock,
    v_would_succeed, v_shortfall,
    CASE WHEN v_branch_id IS NULL THEN 'fallback_branch_missing' ELSE NULL END
  );
EXCEPTION WHEN OTHERS THEN
  -- Shadow logging must NEVER break checkout.
  INSERT INTO public.staff_alerts(kind, severity, title, body, payload, channels)
  VALUES ('inventory_shadow_failure', 'warn',
          'Shadow log failed',
          'log_inventory_shadow raised: ' || SQLERRM,
          jsonb_build_object('order_id', _order_id, 'legacy_id', _legacy_id, 'sqlstate', SQLSTATE),
          ARRAY['dashboard']);
END;
$fn$;

REVOKE ALL ON FUNCTION public.log_inventory_shadow(text,integer,integer) FROM PUBLIC, anon, authenticated;
-- Only callable from SECURITY DEFINER place_order (same owner) and service_role
GRANT EXECUTE ON FUNCTION public.log_inventory_shadow(text,integer,integer) TO service_role;

-- 4) Patch place_order to call shadow log (SELECT-only side-effect; no behavior change)
CREATE OR REPLACE FUNCTION public.place_order(_id text, _customer jsonb, _items jsonb, _discount_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_rl_ok boolean;
BEGIN
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

  v_rl_ok := public.consume_rate_limit('place_order:phone:' || v_phone, 5, 60);
  IF NOT v_rl_ok THEN RAISE EXCEPTION 'rate_limited'; END IF;

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

    -- Phase 5A Shadow Read: SELECT-only, never blocks, never mutates.
    PERFORM public.log_inventory_shadow(_id, v_legacy_id, v_qty);

    IF v_track THEN
      UPDATE public.products SET stock_qty = stock_qty - v_qty WHERE legacy_id = v_legacy_id;
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
END; $function$;

-- 5) Reconciliation Job: products.stock_qty vs SUM(branch_inventory.qty)
-- Writes INVENTORY_MISMATCH alerts to operations_alerts; never mutates data.
CREATE OR REPLACE FUNCTION public.reconcile_inventory_mismatch()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_checked int := 0;
  v_mismatched int := 0;
  r record;
  v_dedupe text;
BEGIN
  FOR r IN
    SELECT p.id AS product_id,
           p.legacy_id,
           p.name,
           p.stock_qty AS legacy_stock,
           COALESCE(SUM(bi.qty),0)::int AS branch_total
    FROM public.products p
    LEFT JOIN public.branch_inventory bi ON bi.product_id = p.id
    GROUP BY p.id, p.legacy_id, p.name, p.stock_qty
  LOOP
    v_checked := v_checked + 1;
    IF r.legacy_stock IS DISTINCT FROM r.branch_total THEN
      v_mismatched := v_mismatched + 1;
      v_dedupe := 'INVENTORY_MISMATCH:' || r.product_id::text;
      INSERT INTO public.operations_alerts(kind, ref_id, summary, severity, dedupe_key, status)
      VALUES (
        'INVENTORY_MISMATCH',
        r.product_id::text,
        format('Product %s (legacy %s): legacy_stock=%s vs branch_total=%s (delta %s)',
               r.name, r.legacy_id, r.legacy_stock, r.branch_total,
               r.branch_total - r.legacy_stock),
        'warn',
        v_dedupe,
        'open'
      )
      ON CONFLICT (dedupe_key) DO UPDATE
        SET summary = EXCLUDED.summary,
            severity = EXCLUDED.severity,
            status = CASE WHEN public.operations_alerts.status = 'resolved' THEN 'open'
                          ELSE public.operations_alerts.status END;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'checked', v_checked,
    'mismatched', v_mismatched,
    'ran_at', now()
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.reconcile_inventory_mismatch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_inventory_mismatch() TO service_role;

-- 6) Inventory Readiness Report (read-only)
CREATE OR REPLACE FUNCTION public.inventory_readiness_report()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'products_count', (SELECT count(*) FROM public.products),
    'published_count', (SELECT count(*) FROM public.products WHERE is_published),
    'track_stock_enabled_count', (SELECT count(*) FROM public.products WHERE track_stock),
    'track_stock_disabled_count', (SELECT count(*) FROM public.products WHERE NOT track_stock),
    'branches_active', (SELECT count(*) FROM public.branches WHERE is_active),
    'branch_inventory_rows', (SELECT count(*) FROM public.branch_inventory),
    'products_with_branch_inv', (SELECT count(DISTINCT product_id) FROM public.branch_inventory),
    'products_without_branch_inv',
      (SELECT count(*) FROM public.products p
        WHERE NOT EXISTS (SELECT 1 FROM public.branch_inventory bi WHERE bi.product_id = p.id)),
    'shadow_log_total', (SELECT count(*) FROM public.inventory_shadow_log),
    'shadow_log_mismatches', (SELECT count(*) FROM public.inventory_shadow_log WHERE NOT would_succeed),
    'open_inventory_mismatch_alerts',
      (SELECT count(*) FROM public.operations_alerts
        WHERE kind = 'INVENTORY_MISMATCH' AND status = 'open'),
    'inventory_write_mode',
      (SELECT value FROM public.app_settings WHERE key = 'inventory_write_mode'),
    'generated_at', now()
  );
$fn$;

REVOKE ALL ON FUNCTION public.inventory_readiness_report() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_readiness_report() TO authenticated, service_role;
