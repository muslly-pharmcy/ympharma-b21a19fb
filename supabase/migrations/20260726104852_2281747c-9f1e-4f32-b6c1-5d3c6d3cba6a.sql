
-- =====================================================================
-- P1 SECURITY: restrict anon column visibility on three exposed tables
-- Strategy: revoke SELECT from anon on base table, then grant SELECT on
-- a narrow safe-column list. authenticated keeps full SELECT (RLS
-- filters rows via existing org/role policies).
-- =====================================================================

-- ---- catalog_products ----
REVOKE SELECT ON TABLE public.catalog_products FROM anon;
GRANT SELECT (
  id, category_id, name_ar, name_en, generic_name, brand, manufacturer,
  barcode, active_ingredients, dosage_form, strength,
  description_ar, description_en, status, is_public,
  requires_prescription, sbdma_official_price, manufacturer_country,
  store_code, pack_unit, image_url, created_at, updated_at
) ON public.catalog_products TO anon;

-- ---- product_classifications ----
REVOKE SELECT ON TABLE public.product_classifications FROM anon;
GRANT SELECT (
  id, product_legacy_id, generic_name, active_ingredient,
  therapeutic_category, pharmacological_class, conditions,
  is_chronic, requires_prescription, related_legacy_ids,
  complementary_legacy_ids, status, created_at, updated_at
) ON public.product_classifications TO anon;

-- ---- provider_ranking_scores ----
-- Tighten the "true" policy to at least require verified rows, and
-- restrict anon columns to public ranking summary.
DROP POLICY IF EXISTS "Public read ranking" ON public.provider_ranking_scores;
CREATE POLICY "Public read verified ranking"
  ON public.provider_ranking_scores
  FOR SELECT
  TO anon, authenticated
  USING (verified = true);

REVOKE SELECT ON TABLE public.provider_ranking_scores FROM anon;
GRANT SELECT (
  id, provider_kind, provider_id, score, level, rating,
  reviews_count, years_experience, response_rate, verified
) ON public.provider_ranking_scores TO anon;
