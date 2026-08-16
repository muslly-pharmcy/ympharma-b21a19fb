
CREATE OR REPLACE FUNCTION public.get_order_public(_id text, _phone_last4 text, _client_ip text DEFAULT NULL)
RETURNS TABLE(id text, status text, total numeric, created_at timestamptz, customer_name text, items jsonb)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
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
    SELECT o.id, o.status, o.total, o.created_at, o.customer_name, o.items
    FROM public.orders o WHERE o.id = _id;
END; $$;
REVOKE ALL ON FUNCTION public.get_order_public(text,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_order_public(text,text,text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_order_history_public(_id text, _phone_last4 text, _client_ip text DEFAULT NULL)
RETURNS TABLE(status text, created_at timestamptz, note text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
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
