
-- Create conditions_catalog RPC (eliminates 404 PGRST202)
-- Also adds composite index for paginated published products
CREATE OR REPLACE FUNCTION public.conditions_catalog()
RETURNS TABLE (condition text, product_count bigint, chronic_count bigint, sample_image text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH expanded AS (
    SELECT unnest(pc.conditions) AS condition, pc.product_legacy_id, pc.is_chronic
    FROM public.product_classifications pc
    WHERE pc.status = 'approved' AND pc.conditions IS NOT NULL
  )
  SELECT
    e.condition,
    count(DISTINCT e.product_legacy_id)::bigint AS product_count,
    count(DISTINCT e.product_legacy_id) FILTER (WHERE e.is_chronic)::bigint AS chronic_count,
    (SELECT p.image_url FROM public.products p
       WHERE p.legacy_id = (SELECT min(e2.product_legacy_id) FROM expanded e2 WHERE e2.condition = e.condition)
       LIMIT 1) AS sample_image
  FROM expanded e
  GROUP BY e.condition
  ORDER BY product_count DESC;
$$;

GRANT EXECUTE ON FUNCTION public.conditions_catalog() TO anon, authenticated;

-- Composite index supporting paginated, sorted published product reads
CREATE INDEX IF NOT EXISTS products_published_recent_idx
  ON public.products (is_published, created_at DESC)
  WHERE is_published = true;
