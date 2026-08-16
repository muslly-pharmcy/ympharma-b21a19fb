
ALTER TABLE public.catalog_products
  ADD COLUMN IF NOT EXISTS store_code text,
  ADD COLUMN IF NOT EXISTS supplier_name_text text,
  ADD COLUMN IF NOT EXISTS pack_unit text,
  ADD COLUMN IF NOT EXISTS image_url text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_products_store_code_org
  ON public.catalog_products (organization_id, store_code)
  WHERE store_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_catalog_products_supplier_name_text
  ON public.catalog_products (supplier_name_text);

-- store_products: read-only view for storefront/admin consumers.
-- Aggregates on-hand stock per org from inv_stock_batches.
DROP VIEW IF EXISTS public.store_products;
CREATE VIEW public.store_products
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.organization_id,
  p.store_code,
  COALESCE(p.name_ar, p.name_en)          AS name,
  p.name_ar,
  p.name_en,
  p.brand,
  p.generic_name,
  p.barcode,
  p.dosage_form,
  p.strength,
  p.manufacturer,
  p.manufacturer_country,
  p.supplier_name_text,
  p.pack_unit,
  p.sbdma_official_price                  AS price,
  p.image_url,
  p.status,
  p.is_public,
  p.requires_prescription,
  p.category_id,
  p.updated_at,
  COALESCE((
    SELECT SUM(b.qty_on_hand)::numeric
    FROM public.inv_stock_batches b
    WHERE b.product_id = p.id
      AND b.organization_id = p.organization_id
  ), 0) AS stock_balance
FROM public.catalog_products p;

GRANT SELECT ON public.store_products TO authenticated;
GRANT SELECT ON public.store_products TO service_role;
