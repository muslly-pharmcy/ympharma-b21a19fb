
-- ============================================================
-- Phase 5B: Dual-Write Foundation (scaffolding only)
-- Production stays on inventory_write_mode='legacy_only'.
-- ============================================================

-- 1) orders.branch_id (nullable; analytical only, no routing)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);

CREATE INDEX IF NOT EXISTS orders_branch_id_idx ON public.orders(branch_id);

-- 2) Helper: read current write mode (defaults to legacy_only)
CREATE OR REPLACE FUNCTION public.current_inventory_write_mode()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT COALESCE(
    (SELECT trim(both '"' FROM value::text)
       FROM public.app_settings
      WHERE key = 'inventory_write_mode'),
    'legacy_only'
  );
$fn$;
REVOKE ALL ON FUNCTION public.current_inventory_write_mode() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_inventory_write_mode() TO authenticated, service_role;

-- 3) Patch place_order: write-mode gate, branch tagging, double-deduction guard
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
BEGIN
  IF EXISTS (SELECT 1 FROM public.orders WHERE id = _id) THEN
    RETURN jsonb_build_object('ok', true, 'id', _id, 'idempotent', true);
  END IF;

  -- Phase 5B: write-mode gate. 'branch_only' is locked until Phase 5C.
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

  -- Analytical branch tagging (BR-001 fallback; NOT a routing decision)
  SELECT id INTO v_branch_id FROM public.branches WHERE code = 'BR-001' LIMIT 1;

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

    -- Phase 5A Shadow Read (SELECT-only)
    PERFORM public.log_inventory_shadow(_id, v_legacy_id, v_qty);

    -- Phase 5B: deduction path branches by mode.
    -- legacy_only: deduct from products.stock_qty (current behavior).
    -- dual_write : same as legacy_only for now; branch_inventory writes
    --              scaffolded in Phase 5C.
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

  INSERT INTO public.orders(id, customer_name, customer_phone, customer_address, notes, total, subtotal, discount_code, discount_amount, status, items, branch_id)
  VALUES (_id, v_name, v_phone, v_address, v_notes, v_total, v_subtotal, NULLIF(trim(coalesce(_discount_code,'')),''), v_discount_amount, 'pending', v_items, v_branch_id);

  IF v_code_id IS NOT NULL THEN
    INSERT INTO public.discount_redemptions(code_id, order_id, customer_phone, amount_off)
    VALUES (v_code_id, _id, v_phone, v_discount_amount);
  END IF;

  -- Phase 5B: double-deduction guard.
  -- place_order already deducted from products.stock_qty above. Any later
  -- call to reserve_order_stock for this id must short-circuit instead of
  -- deducting a second time. We seal the reservation state row now.
  INSERT INTO public.inventory_reservation_state(order_id, state, reserved_at, updated_at)
  VALUES (_id, 'RESERVED', now(), now())
  ON CONFLICT (order_id) DO NOTHING;

  INSERT INTO public.inventory_audit_log(order_id, action, status, reason, payload)
  VALUES (_id, 'RESERVE', 'OK', 'place_order_auto_deduct',
          jsonb_build_object('mode', v_mode, 'branch_id', v_branch_id));

  RETURN jsonb_build_object('ok', true, 'id', _id, 'subtotal', v_subtotal, 'discount_amount', v_discount_amount, 'total', v_total, 'items', v_items, 'mode', v_mode);
END; $function$;

-- 4) reserve_order_stock: clearer audit when blocked by the guard.
CREATE OR REPLACE FUNCTION public.reserve_order_stock(_order_id text, _actor text DEFAULT NULL::text, _reason text DEFAULT 'auto'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  order_row   public.orders%ROWTYPE;
  st_row      public.inventory_reservation_state%ROWTYPE;
  item        JSONB;
  pid         UUID;
  legacy      INT;
  qty         INT;
  prod        public.products%ROWTYPE;
  needs       JSONB := '[]'::jsonb;
  shortages   JSONB := '[]'::jsonb;
  reserved    JSONB := '[]'::jsonb;
  rec         JSONB;
  result      JSONB;
  v_mode      text;
BEGIN
  v_mode := public.current_inventory_write_mode();
  IF v_mode NOT IN ('legacy_only','dual_write') THEN
    RAISE EXCEPTION 'inventory_write_mode_not_supported:%', v_mode;
  END IF;

  SELECT * INTO st_row
    FROM public.inventory_reservation_state
   WHERE order_id = _order_id
   FOR UPDATE;

  IF FOUND AND st_row.state = 'RESERVED' THEN
    INSERT INTO public.inventory_audit_log(order_id, action, status, reason, actor, payload)
      VALUES(_order_id, 'RESERVE', 'SKIPPED_DUPLICATE',
             COALESCE(_reason || ' / already_deducted_at_placement', 'already_deducted_at_placement'),
             _actor,
             jsonb_build_object('previous_reserved_at', st_row.reserved_at, 'mode', v_mode));
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_deducted_or_reserved');
  END IF;

  SELECT * INTO order_row FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN
    INSERT INTO public.inventory_audit_log(order_id, action, status, reason, actor)
      VALUES(_order_id, 'RESERVE', 'FAILED', 'order_not_found', _actor);
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(order_row.items, '[]'::jsonb)) LOOP
    qty    := COALESCE((item->>'quantity')::INT, (item->>'qty')::INT, 1);
    pid    := NULLIF(item->>'product_id', '')::UUID;
    legacy := NULLIF(item->>'legacy_id', '')::INT;
    IF legacy IS NULL THEN legacy := NULLIF(item->>'id','')::INT; END IF;

    IF pid IS NOT NULL THEN
      SELECT * INTO prod FROM public.products WHERE id = pid FOR UPDATE;
    ELSIF legacy IS NOT NULL THEN
      SELECT * INTO prod FROM public.products WHERE legacy_id = legacy FOR UPDATE;
    ELSE
      CONTINUE;
    END IF;

    IF NOT FOUND OR NOT prod.track_stock THEN CONTINUE; END IF;

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

  IF jsonb_array_length(shortages) > 0 THEN
    result := jsonb_build_object('ok', false,
      'order_id', _order_id, 'reserved', '[]'::jsonb, 'shortages', shortages);
    INSERT INTO public.inventory_audit_log(order_id, action, status, reason, actor, payload)
      VALUES(_order_id, 'RESERVE', 'SHORTAGE', _reason, _actor, result);
    RETURN result;
  END IF;

  FOR rec IN SELECT * FROM jsonb_array_elements(needs) LOOP
    UPDATE public.products
       SET stock_qty = stock_qty - (rec->>'qty')::INT,
           updated_at = now()
     WHERE id = (rec->>'product_id')::UUID;
    reserved := reserved || rec;
  END LOOP;

  result := jsonb_build_object('ok', true,
    'order_id', _order_id, 'reserved', reserved, 'shortages', '[]'::jsonb, 'mode', v_mode);

  INSERT INTO public.inventory_reservation_state(order_id, state, reserved_at, updated_at)
    VALUES(_order_id, 'RESERVED', now(), now())
    ON CONFLICT (order_id) DO UPDATE
      SET state='RESERVED', reserved_at=now(), updated_at=now();

  INSERT INTO public.inventory_audit_log(order_id, action, status, reason, actor, payload)
    VALUES(_order_id, 'RESERVE', 'OK', _reason, _actor, result);

  RETURN result;

EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.inventory_audit_log(order_id, action, status, reason, actor, payload)
    VALUES(_order_id, 'RESERVE', 'FAILED', _reason, _actor,
           jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE));
  RAISE;
END;
$function$;
