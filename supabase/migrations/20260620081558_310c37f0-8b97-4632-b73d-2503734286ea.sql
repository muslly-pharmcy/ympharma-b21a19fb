
-- 1) rate_limit_buckets — internal, service-role only
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.rate_limit_buckets TO service_role;
-- Intentionally NO grants to anon/authenticated; only SECURITY DEFINER funcs touch this.

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- Deny-all policy (no one can read/write directly; SECURITY DEFINER bypasses RLS).
DROP POLICY IF EXISTS rate_limit_buckets_no_access ON public.rate_limit_buckets;
CREATE POLICY rate_limit_buckets_no_access
  ON public.rate_limit_buckets FOR ALL
  TO authenticated, anon
  USING (false) WITH CHECK (false);

-- 2) consume_rate_limit(key, max, window_seconds) -> boolean
CREATE OR REPLACE FUNCTION public.consume_rate_limit(_key text, _max integer, _window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_cutoff timestamptz := v_now - make_interval(secs => _window_seconds);
  v_count integer;
BEGIN
  INSERT INTO public.rate_limit_buckets(key, window_start, count, updated_at)
  VALUES (_key, v_now, 1, v_now)
  ON CONFLICT (key) DO UPDATE
    SET count = CASE
                  WHEN public.rate_limit_buckets.window_start < v_cutoff THEN 1
                  ELSE public.rate_limit_buckets.count + 1
                END,
        window_start = CASE
                         WHEN public.rate_limit_buckets.window_start < v_cutoff THEN v_now
                         ELSE public.rate_limit_buckets.window_start
                       END,
        updated_at = v_now
  RETURNING count INTO v_count;

  RETURN v_count <= _max;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO service_role;

-- 3) place_order: prepend rate-limit gate (5 orders / 60s per phone)
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
  v_rl_ok boolean;
BEGIN
  -- Idempotency (before rate-limit so retries of a known id are free)
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

  -- M3: rate-limit by phone (5 orders / 60s)
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
END; $$;

GRANT EXECUTE ON FUNCTION public.place_order(text,jsonb,jsonb,text) TO anon, authenticated;
