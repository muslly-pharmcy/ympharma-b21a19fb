
-- store_products is a security_invoker view. Anon now lacks column-level
-- SELECT on catalog_products.supplier_name_text, so return NULL instead.
CREATE OR REPLACE VIEW public.store_products
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.organization_id,
  p.store_code,
  COALESCE(p.name_ar, p.name_en) AS name,
  p.name_ar,
  p.name_en,
  p.brand,
  p.generic_name,
  p.barcode,
  p.dosage_form,
  p.strength,
  p.manufacturer,
  p.manufacturer_country,
  NULL::text AS supplier_name_text,
  p.pack_unit,
  p.sbdma_official_price AS price,
  p.image_url,
  p.status,
  p.is_public,
  p.requires_prescription,
  p.category_id,
  p.updated_at,
  COALESCE(
    (SELECT sum(b.qty_on_hand)
       FROM public.inv_stock_batches b
      WHERE b.product_id = p.id
        AND b.organization_id = p.organization_id),
    0::numeric
  ) AS stock_balance
FROM public.catalog_products p;
