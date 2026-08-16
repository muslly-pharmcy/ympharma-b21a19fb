
-- 1) Hide supplier_cost & supplier_name from anon (PostgREST honors column privileges).
REVOKE SELECT ON public.products FROM anon;
GRANT SELECT (
  id, legacy_id, name, brand, price, old_price, category, image_url,
  badge, description, is_published, sort_order, created_at, updated_at,
  stock_qty, reorder_point, expiry_date, track_stock
) ON public.products TO anon;

-- 2) Unpublish duplicate products (keep the cheaper / earlier-imported row).
UPDATE public.products SET is_published = false
WHERE id IN (
  '3792b501-7789-453a-9c8c-f3cc63fa8407', -- بروبيوتيك dup (8096)
  '16023cae-eb78-4406-b594-929f013bdfda', -- جنكة dup (8644)
  '4b7ee393-b08d-4959-ad04-eed5ef1c12e6', -- زنك dup (18508)
  '42ea20f8-7b91-476d-8814-3edc6d473b77'  -- B12 dup (17275)
);
