
CREATE OR REPLACE FUNCTION public.search_medicines_public(_q text, _limit int DEFAULT 20)
RETURNS TABLE (
  id uuid,
  name_ar text,
  name_en text,
  generic_name text,
  brand text,
  dosage_form text,
  strength text,
  match_kind text,
  score real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT
      COALESCE(NULLIF(trim(_q), ''), '') AS raw,
      public.catalog_normalize_ar(COALESCE(_q, '')) AS norm
  ),
  base AS (
    SELECT p.id, p.name_ar, p.name_en, p.generic_name, p.brand, p.dosage_form, p.strength,
           public.catalog_normalize_ar(p.name_ar) AS n_ar,
           public.catalog_normalize_ar(COALESCE(p.name_en, '')) AS n_en,
           public.catalog_normalize_ar(COALESCE(p.generic_name, '')) AS n_gen
    FROM public.catalog_products p
    WHERE p.is_public = true AND p.status = 'approved'
  ),
  exact_hits AS (
    SELECT b.id, b.name_ar, b.name_en, b.generic_name, b.brand, b.dosage_form, b.strength,
           'exact'::text AS match_kind, 1.0::real AS score
    FROM base b, q
    WHERE q.norm <> '' AND (b.n_ar = q.norm OR b.n_en = q.norm OR b.n_gen = q.norm)
  ),
  alias_hits AS (
    SELECT b.id, b.name_ar, b.name_en, b.generic_name, b.brand, b.dosage_form, b.strength,
           'alias'::text AS match_kind, 0.9::real AS score
    FROM base b
    JOIN public.catalog_product_aliases a ON a.product_id = b.id
    , q
    WHERE q.norm <> '' AND a.alias_normalized = q.norm
  ),
  trgm_hits AS (
    SELECT b.id, b.name_ar, b.name_en, b.generic_name, b.brand, b.dosage_form, b.strength,
           'fuzzy'::text AS match_kind,
           GREATEST(similarity(b.n_ar, q.norm), similarity(b.n_en, q.norm), similarity(b.n_gen, q.norm))::real AS score
    FROM base b, q
    WHERE q.norm <> ''
      AND (b.n_ar % q.norm OR b.n_en % q.norm OR b.n_gen % q.norm)
  ),
  alias_trgm AS (
    SELECT b.id, b.name_ar, b.name_en, b.generic_name, b.brand, b.dosage_form, b.strength,
           'alias_fuzzy'::text AS match_kind,
           similarity(a.alias_normalized, q.norm)::real AS score
    FROM base b
    JOIN public.catalog_product_aliases a ON a.product_id = b.id
    , q
    WHERE q.norm <> '' AND a.alias_normalized % q.norm
  ),
  unioned AS (
    SELECT * FROM exact_hits
    UNION ALL SELECT * FROM alias_hits
    UNION ALL SELECT * FROM trgm_hits
    UNION ALL SELECT * FROM alias_trgm
  ),
  ranked AS (
    SELECT DISTINCT ON (id) id, name_ar, name_en, generic_name, brand, dosage_form, strength, match_kind, score
    FROM unioned
    ORDER BY id,
      CASE match_kind WHEN 'exact' THEN 0 WHEN 'alias' THEN 1 WHEN 'fuzzy' THEN 2 WHEN 'alias_fuzzy' THEN 3 ELSE 4 END,
      score DESC
  )
  SELECT id, name_ar, name_en, generic_name, brand, dosage_form, strength, match_kind, score
  FROM ranked
  ORDER BY
    CASE match_kind WHEN 'exact' THEN 0 WHEN 'alias' THEN 1 WHEN 'fuzzy' THEN 2 WHEN 'alias_fuzzy' THEN 3 ELSE 4 END,
    score DESC,
    name_ar ASC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 20), 50));
$$;

REVOKE ALL ON FUNCTION public.search_medicines_public(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_medicines_public(text, int) TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.search_medicines_public(text, int) IS
  'Phoenix P7-A: public medicine search — exact/alias/fuzzy ranking over approved public catalog products.';
