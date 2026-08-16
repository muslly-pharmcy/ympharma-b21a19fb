
-- Order status history for timeline tracking
CREATE TABLE public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  changed_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.order_status_history TO anon, authenticated;
GRANT ALL ON public.order_status_history TO service_role;

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public can read history of an order" ON public.order_status_history
  FOR SELECT USING (true);

CREATE POLICY "staff can insert history" ON public.order_status_history
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'owner') OR has_permission(auth.uid(),'orders'));

CREATE INDEX idx_osh_order ON public.order_status_history(order_id, created_at DESC);

-- Auto-record status changes
CREATE OR REPLACE FUNCTION public.record_order_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_status_history(order_id, status, changed_by)
    VALUES (NEW.id, NEW.status, auth.uid());
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_status_history(order_id, status, changed_by)
    VALUES (NEW.id, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_record_order_status
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.record_order_status_change();

-- Backfill: seed history for existing orders
INSERT INTO public.order_status_history(order_id, status, created_at)
SELECT id, status, created_at FROM public.orders
WHERE NOT EXISTS (SELECT 1 FROM public.order_status_history h WHERE h.order_id = orders.id);

-- Indexes to speed up stats
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_rx_created_at ON public.prescriptions(created_at DESC);

-- Stats RPC (staff only)
CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Aden')::date;
  v_orders_today int;
  v_rx_today int;
  v_sales_today numeric;
  v_pending int;
  v_pending_rx int;
  v_orders_week int;
  v_sales_week numeric;
  v_top jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'owner')
    OR has_permission(auth.uid(),'orders') OR has_permission(auth.uid(),'prescriptions')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COUNT(*), COALESCE(SUM(total) FILTER (WHERE status <> 'cancelled'),0)
    INTO v_orders_today, v_sales_today
    FROM public.orders
    WHERE (created_at AT TIME ZONE 'Asia/Aden')::date = v_today;

  SELECT COUNT(*) INTO v_rx_today FROM public.prescriptions
    WHERE (created_at AT TIME ZONE 'Asia/Aden')::date = v_today;

  SELECT COUNT(*) INTO v_pending FROM public.orders WHERE status = 'pending';
  SELECT COUNT(*) INTO v_pending_rx FROM public.prescriptions WHERE status = 'pending';

  SELECT COUNT(*), COALESCE(SUM(total) FILTER (WHERE status <> 'cancelled'),0)
    INTO v_orders_week, v_sales_week
    FROM public.orders
    WHERE created_at >= now() - interval '7 days';

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_top FROM (
    SELECT it->>'name' AS name, SUM((it->>'qty')::int) AS qty
    FROM public.orders, jsonb_array_elements(items) AS it
    WHERE created_at >= now() - interval '30 days' AND status <> 'cancelled'
    GROUP BY it->>'name' ORDER BY qty DESC LIMIT 5
  ) t;

  RETURN jsonb_build_object(
    'orders_today', v_orders_today,
    'rx_today', v_rx_today,
    'sales_today', v_sales_today,
    'pending_orders', v_pending,
    'pending_rx', v_pending_rx,
    'orders_week', v_orders_week,
    'sales_week', v_sales_week,
    'top_products', v_top
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;

-- Make order history readable via public RPC for /track
CREATE OR REPLACE FUNCTION public.get_order_history_public(_id text)
RETURNS TABLE(status text, created_at timestamp with time zone, note text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT status, created_at, note FROM public.order_status_history
  WHERE order_id = _id ORDER BY created_at ASC
$$;
GRANT EXECUTE ON FUNCTION public.get_order_history_public(text) TO anon, authenticated;
