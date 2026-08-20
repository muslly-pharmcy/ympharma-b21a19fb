
-- 1) Realtime for prescription approval status (used by /upload-prescription)
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_approval_requests;

-- 2) Helpful index on approvals for admin filters
CREATE INDEX IF NOT EXISTS idx_agent_approval_status_created
  ON public.agent_approval_requests(status, created_at DESC);

-- 3) Daily pg_cron job to recompute loyalty tiers for every account
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  -- replace existing job if any (cron.schedule errors on duplicate name)
  PERFORM cron.unschedule('recompute-loyalty-tiers-daily')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'recompute-loyalty-tiers-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'recompute-loyalty-tiers-daily',
  '0 0 * * *',
  $cron$
  SELECT public.recompute_loyalty_tier(phone_number) FROM public.loyalty_accounts;
  $cron$
);

-- 4) Admin-only RPC: top selling products from orders.items jsonb
CREATE OR REPLACE FUNCTION public.top_selling_products(_days integer DEFAULT 30, _limit integer DEFAULT 20)
RETURNS TABLE (
  product_name text,
  units_sold bigint,
  revenue_yer numeric,
  orders_count bigint,
  current_stock integer,
  current_price numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH items AS (
    SELECT
      (it->>'name')::text AS name,
      COALESCE((it->>'qty')::int, 1) AS qty,
      COALESCE((it->>'price')::numeric, 0) AS price,
      o.id AS order_id
    FROM public.orders o,
         LATERAL jsonb_array_elements(o.items) AS it
    WHERE o.created_at >= now() - make_interval(days => GREATEST(_days, 1))
      AND o.status <> 'cancelled'
      AND (it->>'name') IS NOT NULL
  ),
  agg AS (
    SELECT
      name,
      SUM(qty)::bigint AS units_sold,
      SUM(qty * price)::numeric AS revenue_yer,
      COUNT(DISTINCT order_id)::bigint AS orders_count
    FROM items
    GROUP BY name
  )
  SELECT
    a.name,
    a.units_sold,
    a.revenue_yer,
    a.orders_count,
    p.stock_qty,
    p.price
  FROM agg a
  LEFT JOIN LATERAL (
    SELECT stock_qty, price
    FROM public.products
    WHERE name = a.name
    LIMIT 1
  ) p ON true
  ORDER BY a.units_sold DESC
  LIMIT GREATEST(_limit, 1);
END;
$$;

REVOKE ALL ON FUNCTION public.top_selling_products(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.top_selling_products(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.top_selling_products(integer, integer) TO service_role;
