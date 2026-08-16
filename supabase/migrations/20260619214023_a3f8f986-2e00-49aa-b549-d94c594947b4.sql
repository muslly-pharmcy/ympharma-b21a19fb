
-- ========== C-1: Lock down orders ==========
DROP POLICY IF EXISTS "anyone can create order" ON public.orders;
-- Keep staff read/update. No anon/authenticated INSERT remains.

-- ========== C-3: Lock down prescriptions (gate via SECURITY DEFINER fn) ==========
DROP POLICY IF EXISTS "anyone create prescription" ON public.prescriptions;

-- ========== Tracking rate-limit table ==========
CREATE TABLE IF NOT EXISTS public.tracking_lookups (
  ip text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  count int NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tracking_lookups TO service_role;
ALTER TABLE public.tracking_lookups ENABLE ROW LEVEL SECURITY;
-- No policies — only SECURITY DEFINER functions touch this table.

-- ========== Helper: per-IP rate limit (reused by tracking + future hooks) ==========
CREATE OR REPLACE FUNCTION public.check_tracking_rate_limit(_ip text, _max int DEFAULT 30, _window_seconds int DEFAULT 600)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF _ip IS NULL OR length(_ip) = 0 THEN _ip := 'unknown'; END IF;
  INSERT INTO public.tracking_lookups AS r (ip, window_start, count, updated_at)
  VALUES (_ip, now(), 1, now())
  ON CONFLICT (ip) DO UPDATE SET
    window_start = CASE WHEN r.window_start < now() - make_interval(secs => _window_seconds) THEN now() ELSE r.window_start END,
    count = CASE WHEN r.window_start < now() - make_interval(secs => _window_seconds) THEN 1 ELSE r.count + 1 END,
    updated_at = now()
  RETURNING count INTO v_count;
  RETURN v_count <= _max;
END; $$;
REVOKE ALL ON FUNCTION public.check_tracking_rate_limit(text,int,int) FROM public;
GRANT EXECUTE ON FUNCTION public.check_tracking_rate_limit(text,int,int) TO anon, authenticated, service_role;

-- ========== C-1: place_order RPC — server-side pricing authority ==========
CREATE OR REPLACE FUNCTION public.place_order(_id text, _customer jsonb, _items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text := trim(coalesce(_customer->>'name',''));
  v_phone text := trim(coalesce(_customer->>'phone',''));
  v_address text := trim(coalesce(_customer->>'address',''));
  v_notes text := nullif(trim(coalesce(_customer->>'notes','')), '');
  v_total numeric := 0;
  v_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_legacy_id int;
  v_qty int;
  v_price numeric;
  v_pname text;
  v_published boolean;
BEGIN
  -- Idempotency: same id → no double-insert (used by retry queue).
  IF EXISTS (SELECT 1 FROM public.orders WHERE id = _id) THEN
    RETURN jsonb_build_object('ok', true, 'id', _id, 'idempotent', true);
  END IF;

  IF _id IS NULL OR length(_id) < 4 OR length(_id) > 64 OR _id !~ '^[A-Za-z0-9_-]+$' THEN
    RAISE EXCEPTION 'invalid_id';
  END IF;
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
    IF v_legacy_id IS NULL OR v_qty IS NULL OR v_qty < 1 OR v_qty > 999 THEN
      RAISE EXCEPTION 'invalid_item';
    END IF;
    SELECT p.name, p.price, p.is_published INTO v_pname, v_price, v_published
      FROM public.products p WHERE p.legacy_id = v_legacy_id;
    IF v_price IS NULL THEN RAISE EXCEPTION 'unknown_product:%', v_legacy_id; END IF;
    IF NOT v_published THEN RAISE EXCEPTION 'unpublished_product:%', v_legacy_id; END IF;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id', v_legacy_id, 'qty', v_qty, 'name', v_pname, 'price', v_price
    ));
    v_total := v_total + (v_price * v_qty);
  END LOOP;

  -- Hard guard rails on totals
  IF v_total <= 0 OR v_total > 10000000 THEN RAISE EXCEPTION 'invalid_total:%', v_total; END IF;

  INSERT INTO public.orders(id, customer_name, customer_phone, customer_address, notes, total, status, items)
  VALUES (_id, v_name, v_phone, v_address, v_notes, v_total, 'pending', v_items);

  RETURN jsonb_build_object('ok', true, 'id', _id, 'total', v_total, 'items', v_items);
END; $$;
REVOKE ALL ON FUNCTION public.place_order(text, jsonb, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.place_order(text, jsonb, jsonb) TO anon, authenticated, service_role;

-- ========== submit_prescription RPC — validates payload + URL origin ==========
CREATE OR REPLACE FUNCTION public.submit_prescription(_id text, _customer jsonb, _image_urls text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text := trim(coalesce(_customer->>'name',''));
  v_phone text := trim(coalesce(_customer->>'phone',''));
  v_address text := trim(coalesce(_customer->>'address',''));
  v_notes text := nullif(trim(coalesce(_customer->>'notes','')), '');
  v_url text;
  v_count int := COALESCE(array_length(_image_urls, 1), 0);
  v_supabase_url text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.prescriptions WHERE id = _id) THEN
    RETURN jsonb_build_object('ok', true, 'id', _id, 'idempotent', true);
  END IF;

  IF _id IS NULL OR length(_id) < 4 OR length(_id) > 64 OR _id !~ '^[A-Za-z0-9_-]+$' THEN
    RAISE EXCEPTION 'invalid_id';
  END IF;
  IF length(v_name) < 2 OR length(v_name) > 120 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  IF length(v_phone) < 6 OR length(v_phone) > 30 THEN RAISE EXCEPTION 'invalid_phone'; END IF;
  IF length(v_address) < 3 OR length(v_address) > 500 THEN RAISE EXCEPTION 'invalid_address'; END IF;
  IF v_notes IS NOT NULL AND length(v_notes) > 1000 THEN RAISE EXCEPTION 'invalid_notes'; END IF;
  IF v_count = 0 OR v_count > 10 THEN RAISE EXCEPTION 'invalid_image_count'; END IF;

  -- Enforce that URLs come from this project's storage origin.
  FOREACH v_url IN ARRAY _image_urls LOOP
    IF v_url IS NULL OR length(v_url) > 2048 THEN RAISE EXCEPTION 'invalid_image_url'; END IF;
    IF v_url !~ '^https://[A-Za-z0-9-]+\.supabase\.co/storage/v1/' THEN
      RAISE EXCEPTION 'untrusted_image_origin';
    END IF;
  END LOOP;

  INSERT INTO public.prescriptions(id, customer_name, customer_phone, customer_address, notes, image_urls, status)
  VALUES (_id, v_name, v_phone, v_address, v_notes, _image_urls, 'pending');

  RETURN jsonb_build_object('ok', true, 'id', _id);
END; $$;
REVOKE ALL ON FUNCTION public.submit_prescription(text, jsonb, text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_prescription(text, jsonb, text[]) TO anon, authenticated, service_role;

-- ========== C-3: Tracking now requires phone last-4 + rate limit ==========
DROP FUNCTION IF EXISTS public.get_order_public(text);
DROP FUNCTION IF EXISTS public.get_order_history_public(text);

CREATE OR REPLACE FUNCTION public.get_order_public(_id text, _phone_last4 text, _client_ip text DEFAULT NULL)
RETURNS TABLE(id text, status text, total numeric, created_at timestamptz, customer_name text, items jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_phone text;
  v_digits text;
  v_in_digits text;
BEGIN
  IF _id IS NULL OR _phone_last4 IS NULL THEN RETURN; END IF;
  v_in_digits := right(regexp_replace(_phone_last4, '\D', '', 'g'), 4);
  IF length(v_in_digits) <> 4 THEN RETURN; END IF;
  -- Rate-limit BEFORE doing the lookup (counts both hits and misses).
  IF NOT public.check_tracking_rate_limit(COALESCE(_client_ip,'unknown'), 30, 600) THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;
  SELECT customer_phone INTO v_phone FROM public.orders WHERE public.orders.id = _id;
  IF v_phone IS NULL THEN RETURN; END IF;
  v_digits := right(regexp_replace(v_phone, '\D', '', 'g'), 4);
  IF v_digits <> v_in_digits THEN RETURN; END IF;
  RETURN QUERY
    SELECT o.id, o.status, o.total, o.created_at, o.customer_name, o.items
    FROM public.orders o WHERE o.id = _id;
END; $$;
REVOKE ALL ON FUNCTION public.get_order_public(text,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_order_public(text,text,text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_order_history_public(_id text, _phone_last4 text, _client_ip text DEFAULT NULL)
RETURNS TABLE(status text, created_at timestamptz, note text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_phone text; v_digits text; v_in_digits text;
BEGIN
  IF _id IS NULL OR _phone_last4 IS NULL THEN RETURN; END IF;
  v_in_digits := right(regexp_replace(_phone_last4, '\D', '', 'g'), 4);
  IF length(v_in_digits) <> 4 THEN RETURN; END IF;
  IF NOT public.check_tracking_rate_limit(COALESCE(_client_ip,'unknown'), 30, 600) THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;
  SELECT customer_phone INTO v_phone FROM public.orders WHERE public.orders.id = _id;
  IF v_phone IS NULL THEN RETURN; END IF;
  v_digits := right(regexp_replace(v_phone, '\D', '', 'g'), 4);
  IF v_digits <> v_in_digits THEN RETURN; END IF;
  RETURN QUERY
    SELECT h.status, h.created_at, h.note FROM public.order_status_history h
    WHERE h.order_id = _id ORDER BY h.created_at ASC;
END; $$;
REVOKE ALL ON FUNCTION public.get_order_history_public(text,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_order_history_public(text,text,text) TO anon, authenticated, service_role;
