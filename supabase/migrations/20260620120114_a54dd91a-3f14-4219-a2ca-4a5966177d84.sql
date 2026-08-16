-- Phase 5C: Pilot Group + Controlled Dual-Write

-- 1) Pilot tagging column
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS inventory_migration_group text;

CREATE INDEX IF NOT EXISTS idx_products_inventory_migration_group
  ON public.products(inventory_migration_group)
  WHERE inventory_migration_group IS NOT NULL;

COMMENT ON COLUMN public.products.inventory_migration_group IS
  'Phase 5C: tag (e.g. ''pilot'') marking a product for the dual-write inventory pilot. NULL = legacy behaviour only.';

-- 2) Pilot management helper (admin-only via RLS-aware caller; SECURITY DEFINER, guarded)
CREATE OR REPLACE FUNCTION public.set_inventory_pilot(_legacy_ids int[], _group text DEFAULT 'pilot')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _group IS NOT NULL AND _group !~ '^[a-z0-9_]{2,32}$' THEN
    RAISE EXCEPTION 'invalid_group';
  END IF;
  UPDATE public.products
     SET inventory_migration_group = _group
   WHERE legacy_id = ANY(_legacy_ids);
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'updated', v_updated, 'group', _group);
END; $$;

REVOKE ALL ON FUNCTION public.set_inventory_pilot(int[], text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_inventory_pilot(int[], text) TO authenticated;

-- 3) Pilot status report
CREATE OR REPLACE FUNCTION public.inventory_pilot_report()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
  v_count int;
  v_tracked int;
  v_mode text;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  v_mode := public.current_inventory_write_mode();
  SELECT count(*), count(*) FILTER (WHERE track_stock)
    INTO v_count, v_tracked
    FROM public.products
   WHERE inventory_migration_group = 'pilot';

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'legacy_id', p.legacy_id,
           'name', p.name,
           'stock_qty', p.stock_qty,
           'track_stock', p.track_stock,
           'branch_inventory_total', coalesce((SELECT sum(qty) FROM public.branch_inventory bi WHERE bi.product_id = p.id), 0)
         ) ORDER BY p.name), '[]'::jsonb)
    INTO v_rows
    FROM public.products p
   WHERE p.inventory_migration_group = 'pilot';

  RETURN jsonb_build_object(
    'inventory_write_mode', v_mode,
    'pilot_count', v_count,
    'pilot_tracked_count', v_tracked,
    'products', v_rows,
    'generated_at', now()
  );
END; $$;

REVOKE ALL ON FUNCTION public.inventory_pilot_report() FROM public;
GRANT EXECUTE ON FUNCTION public.inventory_pilot_report() TO authenticated;

-- 4) place_order: add controlled dual-write for pilot products
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
  v_mode text;
  v_branch_id uuid;
  v_product_id uuid;
  v_pilot_group text;
  v_bi_updated int;
  v_bi_total int;
  v_legacy_after int;
BEGIN
  IF EXISTS (SELECT 1 FROM public.orders WHERE id = _id) THEN
    RETURN jsonb_build_object('ok', true, 'id', _id, 'idempotent', true);
  END IF;

  -- Phase 5C: write-mode gate. 'branch_only' still locked.
  v_mode := public.current_inventory_write_mode();
  IF v_mode NOT IN ('legacy_only','dual_write') THEN
    RAISE EXCEPTION 'inventory_write_mode_not_supported:%', v_mode;
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

  SELECT id INTO v_branch_id FROM public.branches WHERE code = 'BR-001' LIMIT 1;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_legacy_id := NULLIF(v_item->>'id','')::int;
    v_qty := NULLIF(v_item->>'qty','')::int;
    IF v_legacy_id IS NULL OR v_qty IS NULL OR v_qty < 1 OR v_qty > 999 THEN RAISE EXCEPTION 'invalid_item'; END IF;
    SELECT p.id, p.name, p.price, p.is_published, p.stock_qty, p.track_stock, p.inventory_migration_group
      INTO v_product_id, v_pname, v_price, v_published, v_stock, v_track, v_pilot_group
      FROM public.products p WHERE p.legacy_id = v_legacy_id
      FOR UPDATE;
    IF v_price IS NULL THEN RAISE EXCEPTION 'unknown_product:%', v_legacy_id; END IF;
    IF NOT v_published THEN RAISE EXCEPTION 'unpublished_product:%', v_legacy_id; END IF;
    IF v_track AND v_stock < v_qty THEN RAISE EXCEPTION 'insufficient_stock:%:%', v_legacy_id, v_stock; END IF;

    PERFORM public.log_inventory_shadow(_id, v_legacy_id, v_qty);

    IF v_track THEN
      UPDATE public.products SET stock_qty = stock_qty - v_qty WHERE legacy_id = v_legacy_id;
      v_legacy_after := v_stock - v_qty;

      IF v_legacy_after <= (SELECT reorder_point FROM public.products WHERE legacy_id = v_legacy_id) THEN
        INSERT INTO public.staff_alerts(kind, severity, title, body, entity_type, entity_id, payload, channels)
        VALUES ('low_stock','warn',
                'مخزون منخفض: ' || v_pname,
                'تبقى ' || v_legacy_after::text || ' وحدة',
                'product', v_legacy_id::text,
                jsonb_build_object('legacy_id', v_legacy_id, 'remaining', v_legacy_after),
                ARRAY['dashboard','whatsapp']);
      END IF;

      -- Phase 5C: controlled dual-write for pilot products only.
      IF v_mode = 'dual_write' AND v_pilot_group = 'pilot' AND v_branch_id IS NOT NULL THEN
        UPDATE public.branch_inventory
           SET qty = GREATEST(0, qty - v_qty),
               updated_at = now()
         WHERE branch_id = v_branch_id AND product_id = v_product_id;
        GET DIAGNOSTICS v_bi_updated = ROW_COUNT;

        IF v_bi_updated = 0 THEN
          -- Pilot product missing a branch_inventory row → mismatch alert, do NOT block order.
          INSERT INTO public.operations_alerts(kind, ref_id, summary, severity, dedupe_key)
          VALUES ('DUAL_WRITE_MISMATCH', v_legacy_id::text,
                  'Pilot product missing branch_inventory row for branch BR-001: ' || v_pname,
                  'error',
                  'dual_write_missing:' || v_legacy_id::text)
          ON CONFLICT (dedupe_key) DO NOTHING;
        ELSE
          SELECT coalesce(sum(qty),0) INTO v_bi_total
            FROM public.branch_inventory WHERE product_id = v_product_id;
          IF v_bi_total <> v_legacy_after THEN
            INSERT INTO public.operations_alerts(kind, ref_id, summary, severity, dedupe_key)
            VALUES ('DUAL_WRITE_MISMATCH', v_legacy_id::text,
                    'Dual-write mismatch on ' || v_pname || ': legacy=' || v_legacy_after::text
                      || ' vs branch_total=' || v_bi_total::text,
                    'error',
                    'dual_write_mismatch:' || v_legacy_id::text || ':' || to_char(now(),'YYYY-MM-DD"T"HH24'))
            ON CONFLICT (dedupe_key) DO NOTHING;
          END IF;
        END IF;

        INSERT INTO public.inventory_audit_log(order_id, action, status, reason, payload)
        VALUES (_id, 'DUAL_WRITE', 'OK', 'pilot_branch_deduct',
                jsonb_build_object('legacy_id', v_legacy_id, 'branch_id', v_branch_id,
                                   'qty', v_qty, 'legacy_after', v_legacy_after, 'branch_total', v_bi_total));
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

  INSERT INTO public.orders(id, customer_name, customer_phone, customer_address, notes, total, subtotal, discount_code, discount_amount, status, items, branch_id)
  VALUES (_id, v_name, v_phone, v_address, v_notes, v_total, v_subtotal, NULLIF(trim(coalesce(_discount_code,'')),''), v_discount_amount, 'pending', v_items, v_branch_id);

  IF v_code_id IS NOT NULL THEN
    INSERT INTO public.discount_redemptions(code_id, order_id, customer_phone, amount_off)
    VALUES (v_code_id, _id, v_phone, v_discount_amount);
  END IF;

  INSERT INTO public.inventory_reservation_state(order_id, state, reserved_at, updated_at)
  VALUES (_id, 'RESERVED', now(), now())
  ON CONFLICT (order_id) DO NOTHING;

  INSERT INTO public.inventory_audit_log(order_id, action, status, reason, payload)
  VALUES (_id, 'RESERVE', 'OK', 'place_order_auto_deduct',
          jsonb_build_object('mode', v_mode, 'branch_id', v_branch_id));

  RETURN jsonb_build_object('ok', true, 'id', _id, 'subtotal', v_subtotal, 'discount_amount', v_discount_amount, 'total', v_total, 'items', v_items, 'mode', v_mode);
END; $function$;

-- 5) Extend hourly reconciliation: pilot products also raise DUAL_WRITE_MISMATCH
CREATE OR REPLACE FUNCTION public.reconcile_inventory_mismatch()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_checked int := 0;
  v_mismatched int := 0;
  r record;
  v_bi_total int;
BEGIN
  FOR r IN
    SELECT p.id, p.legacy_id, p.name, p.stock_qty, p.inventory_migration_group
      FROM public.products p
     WHERE p.is_published = true
  LOOP
    v_checked := v_checked + 1;
    SELECT coalesce(sum(qty),0) INTO v_bi_total
      FROM public.branch_inventory WHERE product_id = r.id;

    IF v_bi_total <> r.stock_qty THEN
      v_mismatched := v_mismatched + 1;
      INSERT INTO public.operations_alerts(kind, ref_id, summary, severity, dedupe_key)
      VALUES ('INVENTORY_MISMATCH', r.legacy_id::text,
              'Stock mismatch on ' || r.name || ': products.stock_qty=' || r.stock_qty::text
                || ' vs branch_total=' || v_bi_total::text,
              'warn',
              'inv_mismatch:' || r.legacy_id::text || ':' || to_char(now(),'YYYY-MM-DD"T"HH24'))
      ON CONFLICT (dedupe_key) DO NOTHING;

      IF r.inventory_migration_group = 'pilot' THEN
        INSERT INTO public.operations_alerts(kind, ref_id, summary, severity, dedupe_key)
        VALUES ('DUAL_WRITE_MISMATCH', r.legacy_id::text,
                'Pilot reconciliation drift on ' || r.name || ': legacy=' || r.stock_qty::text
                  || ' vs branch_total=' || v_bi_total::text,
                'error',
                'dual_write_recon:' || r.legacy_id::text || ':' || to_char(now(),'YYYY-MM-DD"T"HH24'))
        ON CONFLICT (dedupe_key) DO NOTHING;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'checked', v_checked, 'mismatched', v_mismatched, 'ran_at', now());
END; $$;

REVOKE ALL ON FUNCTION public.reconcile_inventory_mismatch() FROM public;
GRANT EXECUTE ON FUNCTION public.reconcile_inventory_mismatch() TO service_role;
