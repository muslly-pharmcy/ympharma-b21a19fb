
-- ============================================================
-- FEFO Checkout RPC + Admin Order Management
-- ============================================================

-- 1) Atomic FEFO checkout RPC
CREATE OR REPLACE FUNCTION public.checkout_cart_fefo(
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_shipping_zone_id uuid,
  p_payment_method_code text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_cart record;
  v_needed numeric;
  v_batch record;
  v_take numeric;
  v_order_id text;
  v_zone record;
  v_method record;
  v_items jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
  v_shipping_fee numeric := 0;
  v_total numeric := 0;
  v_zone_name text;
  v_requires_receipt boolean := false;
  v_payment_status text;
  v_line_total numeric;
  v_line jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  -- Resolve caller organization (first active membership)
  SELECT organization_id INTO v_org_id
  FROM organization_members
  WHERE user_id = v_user_id
    AND (status IS NULL OR status = 'active')
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'NO_ORG_MEMBERSHIP: user has no active organization';
  END IF;

  -- Shipping zone
  SELECT id, fee, name_ar, is_active INTO v_zone
  FROM shipping_zones WHERE id = p_shipping_zone_id;
  IF NOT FOUND OR NOT v_zone.is_active THEN
    RAISE EXCEPTION 'SHIPPING_ZONE_UNAVAILABLE';
  END IF;
  v_shipping_fee := COALESCE(v_zone.fee, 0);
  v_zone_name := v_zone.name_ar;

  -- Payment method
  SELECT code, requires_receipt, is_active INTO v_method
  FROM payment_methods WHERE code = p_payment_method_code;
  IF NOT FOUND OR NOT v_method.is_active THEN
    RAISE EXCEPTION 'PAYMENT_METHOD_UNAVAILABLE';
  END IF;
  v_requires_receipt := COALESCE(v_method.requires_receipt, false);
  v_payment_status := CASE WHEN v_requires_receipt THEN 'awaiting_receipt' ELSE 'pending' END;

  -- Generate order id (matches existing scheme)
  v_order_id := 'ORD-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' ||
                upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

  -- Iterate cart
  FOR v_cart IN
    SELECT ci.product_id, ci.quantity,
           cp.name_ar, cp.brand, cp.strength,
           cp.requires_prescription, cp.status, cp.is_public
    FROM cart_items ci
    JOIN catalog_products cp ON cp.id = ci.product_id
    WHERE ci.user_id = v_user_id
    ORDER BY ci.added_at ASC
  LOOP
    IF v_cart.requires_prescription OR NOT v_cart.is_public OR v_cart.status <> 'approved' THEN
      RAISE EXCEPTION 'PRODUCT_NOT_SELLABLE: %', v_cart.name_ar;
    END IF;

    v_needed := v_cart.quantity;
    v_line_total := 0;

    -- FEFO loop over batches
    FOR v_batch IN
      SELECT id, warehouse_id, qty_on_hand, qty_reserved, selling_price, expiry_date
      FROM inv_stock_batches
      WHERE product_id = v_cart.product_id
        AND organization_id = v_org_id
        AND qty_on_hand - qty_reserved > 0
        AND (expiry_date IS NULL OR expiry_date > CURRENT_DATE)
      ORDER BY expiry_date ASC NULLS LAST, received_at ASC
      FOR UPDATE SKIP LOCKED
    LOOP
      EXIT WHEN v_needed <= 0;
      v_take := LEAST(v_needed, v_batch.qty_on_hand - v_batch.qty_reserved);
      IF v_take <= 0 THEN CONTINUE; END IF;

      UPDATE inv_stock_batches
      SET qty_on_hand = qty_on_hand - v_take, updated_at = now()
      WHERE id = v_batch.id;

      INSERT INTO inv_stock_movements(
        organization_id, warehouse_id, batch_id, product_id,
        movement_type, qty_delta, actor_user_id,
        reason, ref_type, ref_id, metadata
      ) VALUES (
        v_org_id, v_batch.warehouse_id, v_batch.id, v_cart.product_id,
        'STOCK_SOLD'::inv_movement_type, -v_take, v_user_id,
        'FEFO checkout', 'order', NULL,
        jsonb_build_object('order_id', v_order_id, 'unit_price', v_batch.selling_price)
      );

      v_line_total := v_line_total + (v_take * COALESCE(v_batch.selling_price, 0));
      v_needed := v_needed - v_take;
    END LOOP;

    IF v_needed > 0 THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK: % (short by %)', v_cart.name_ar, v_needed;
    END IF;

    v_line := jsonb_build_object(
      'product_id', v_cart.product_id,
      'name_ar', v_cart.name_ar,
      'brand', v_cart.brand,
      'strength', v_cart.strength,
      'quantity', v_cart.quantity,
      'line_total', round(v_line_total::numeric, 2)
    );
    v_items := v_items || jsonb_build_array(v_line);
    v_subtotal := v_subtotal + v_line_total;
  END LOOP;

  IF jsonb_array_length(v_items) = 0 THEN
    RAISE EXCEPTION 'CART_EMPTY';
  END IF;

  v_subtotal := round(v_subtotal::numeric, 2);
  v_total := round((v_subtotal + v_shipping_fee)::numeric, 2);

  -- Insert order (matches existing orders schema)
  INSERT INTO orders(
    id, user_id, customer_name, customer_phone, customer_address, notes,
    items, subtotal, shipping_fee, total, status,
    shipping_zone_id, payment_method_code, payment_status
  ) VALUES (
    v_order_id, v_user_id, p_customer_name, p_customer_phone,
    v_zone_name || ' — ' || p_customer_address, p_notes,
    v_items, v_subtotal, v_shipping_fee, v_total, 'confirmed',
    p_shipping_zone_id, p_payment_method_code, v_payment_status
  );

  INSERT INTO order_status_history(order_id, status, changed_by, note)
  VALUES (v_order_id, 'confirmed', v_user_id, 'تم إنشاء الطلب وخصم المخزون (FEFO)');

  DELETE FROM cart_items WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'total', v_total,
    'subtotal', v_subtotal,
    'shipping_fee', v_shipping_fee,
    'requires_receipt', v_requires_receipt,
    'payment_method_code', p_payment_method_code
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.checkout_cart_fefo(text, text, text, uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.checkout_cart_fefo(text, text, text, uuid, text, text) TO authenticated;

-- 2) Admin RLS on orders and order_status_history
DROP POLICY IF EXISTS "orders_admin_read"   ON public.orders;
DROP POLICY IF EXISTS "orders_admin_update" ON public.orders;
CREATE POLICY "orders_admin_read"   ON public.orders
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "orders_admin_update" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "osh_admin_read"   ON public.order_status_history;
DROP POLICY IF EXISTS "osh_admin_insert" ON public.order_status_history;
CREATE POLICY "osh_admin_read"   ON public.order_status_history
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "osh_admin_insert" ON public.order_status_history
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND changed_by = auth.uid());
