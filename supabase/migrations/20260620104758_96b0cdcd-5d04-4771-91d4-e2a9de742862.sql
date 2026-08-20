-- Phase 4B: Branch Reorder Suggestions (recommendation engine only)
-- Pure read-only function. Does NOT create transfers, modify orders, or mutate inventory.

CREATE OR REPLACE FUNCTION public.branch_reorder_suggestions(
  _branch_id uuid,
  _lookback_days int DEFAULT 30,
  _coverage_days int DEFAULT 14,
  _limit int DEFAULT 100
)
RETURNS TABLE(
  branch_id uuid,
  product_id uuid,
  product_name text,
  on_hand int,
  reserved int,
  available int,
  reorder_point int,
  movement_qty_30d int,
  daily_velocity numeric,
  suggested_restock_qty int,
  urgency text,
  reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH movement AS (
    -- Inbound to this branch (received transfers) as proxy for replenishment cadence,
    -- and outbound from this branch as consumption proxy.
    SELECT ti.product_id,
           COALESCE(SUM(ti.qty_received), 0)::int AS in_qty,
           0::int AS out_qty
    FROM public.transfer_items ti
    JOIN public.inventory_transfers t ON t.id = ti.transfer_id
    WHERE t.destination_branch_id = _branch_id
      AND t.status::text = 'COMPLETED'
      AND t.updated_at >= now() - make_interval(days => _lookback_days)
    GROUP BY ti.product_id
    UNION ALL
    SELECT ti.product_id, 0::int,
           COALESCE(SUM(ti.qty_received), 0)::int AS out_qty
    FROM public.transfer_items ti
    JOIN public.inventory_transfers t ON t.id = ti.transfer_id
    WHERE t.source_branch_id = _branch_id
      AND t.status::text = 'COMPLETED'
      AND t.updated_at >= now() - make_interval(days => _lookback_days)
    GROUP BY ti.product_id
  ),
  movement_agg AS (
    SELECT product_id,
           SUM(in_qty)::int  AS in_qty,
           SUM(out_qty)::int AS out_qty
    FROM movement GROUP BY product_id
  )
  SELECT
    bi.branch_id,
    bi.product_id,
    p.name AS product_name,
    bi.qty AS on_hand,
    bi.reserved_qty AS reserved,
    GREATEST(bi.qty - bi.reserved_qty, 0) AS available,
    bi.reorder_point,
    COALESCE(ma.out_qty, 0) AS movement_qty_30d,
    ROUND(COALESCE(ma.out_qty, 0)::numeric / NULLIF(_lookback_days, 0), 3) AS daily_velocity,
    GREATEST(
      -- cover N days of velocity, minus what's already available
      CEIL(COALESCE(ma.out_qty, 0)::numeric / NULLIF(_lookback_days, 0) * _coverage_days)::int
        - GREATEST(bi.qty - bi.reserved_qty, 0),
      -- ensure we at least refill to 2x reorder point
      (COALESCE(bi.reorder_point, 0) * 2) - GREATEST(bi.qty - bi.reserved_qty, 0),
      1
    )::int AS suggested_restock_qty,
    CASE
      WHEN GREATEST(bi.qty - bi.reserved_qty, 0) = 0 THEN 'critical'
      WHEN GREATEST(bi.qty - bi.reserved_qty, 0) <= COALESCE(bi.reorder_point, 0) / 2 THEN 'high'
      ELSE 'medium'
    END AS urgency,
    CASE
      WHEN GREATEST(bi.qty - bi.reserved_qty, 0) = 0
        THEN 'Out of stock at branch'
      WHEN GREATEST(bi.qty - bi.reserved_qty, 0) <= COALESCE(bi.reorder_point, 0)
        THEN format('Available %s ≤ reorder_point %s', GREATEST(bi.qty - bi.reserved_qty, 0), bi.reorder_point)
      ELSE 'Below coverage target'
    END AS reason
  FROM public.branch_inventory bi
  JOIN public.products p ON p.id = bi.product_id
  LEFT JOIN movement_agg ma ON ma.product_id = bi.product_id
  WHERE bi.branch_id = _branch_id
    AND bi.reorder_point IS NOT NULL
    AND bi.reorder_point > 0
    AND GREATEST(bi.qty - bi.reserved_qty, 0) <= bi.reorder_point
  ORDER BY
    CASE
      WHEN GREATEST(bi.qty - bi.reserved_qty, 0) = 0 THEN 0
      WHEN GREATEST(bi.qty - bi.reserved_qty, 0) <= COALESCE(bi.reorder_point, 0) / 2 THEN 1
      ELSE 2
    END,
    COALESCE(ma.out_qty, 0) DESC
  LIMIT _limit;
END;
$$;

REVOKE ALL ON FUNCTION public.branch_reorder_suggestions(uuid, int, int, int) FROM public;
GRANT EXECUTE ON FUNCTION public.branch_reorder_suggestions(uuid, int, int, int) TO authenticated, service_role;

-- Helpful index for movement lookup (idempotent)
CREATE INDEX IF NOT EXISTS idx_transfer_items_product ON public.transfer_items(product_id);
CREATE INDEX IF NOT EXISTS idx_branch_inventory_branch_reorder
  ON public.branch_inventory(branch_id) WHERE reorder_point > 0;
