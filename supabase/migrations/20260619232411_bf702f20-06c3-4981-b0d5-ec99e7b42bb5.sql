
-- Helper: arabic labels per category
CREATE OR REPLACE FUNCTION public._therapeutic_label_ar(_cat text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _cat
    WHEN 'diabetes' THEN 'أدوية السكري'
    WHEN 'hypertension' THEN 'أدوية الضغط'
    WHEN 'cardiology' THEN 'أدوية القلب'
    WHEN 'allergy' THEN 'الحساسية'
    WHEN 'asthma' THEN 'الربو والجهاز التنفسي'
    WHEN 'gi' THEN 'الجهاز الهضمي'
    WHEN 'antibiotics' THEN 'المضادات الحيوية'
    WHEN 'neurology' THEN 'الأعصاب'
    WHEN 'dermatology' THEN 'الجلدية'
    WHEN 'pediatrics' THEN 'صحة الطفل'
    WHEN 'womens_health' THEN 'صحة المرأة'
    WHEN 'vitamins' THEN 'الفيتامينات والمكملات'
    WHEN 'pain' THEN 'المسكنات'
    WHEN 'respiratory' THEN 'الجهاز التنفسي'
    WHEN 'ophthalmology' THEN 'العيون'
    WHEN 'urology' THEN 'المسالك البولية'
    WHEN 'hormonal' THEN 'الهرمونات'
    WHEN 'oncology' THEN 'الأورام'
    WHEN 'mental_health' THEN 'الصحة النفسية'
    ELSE 'أخرى'
  END;
$$;

-- Smart search: returns matching legacy_ids with reason. Searches name/brand/category
-- of products, plus approved classification fields (generic, ingredient, drug class,
-- conditions, therapeutic category arabic label).
CREATE OR REPLACE FUNCTION public.pharmacy_search(_q text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb; v_q text;
BEGIN
  v_q := lower(trim(coalesce(_q,'')));
  IF length(v_q) < 2 THEN RETURN '[]'::jsonb; END IF;

  WITH approved AS (
    SELECT c.product_legacy_id AS legacy_id, c.generic_name, c.active_ingredient,
           c.therapeutic_category, c.pharmacological_class, c.conditions
    FROM public.product_classifications c
    WHERE c.status = 'approved'
  ), matches AS (
    -- product name/brand match (always available)
    SELECT p.legacy_id, 'name' AS reason, 5 AS rank
    FROM public.products p
    WHERE p.is_published AND lower(p.name) LIKE '%'||v_q||'%'
    UNION
    SELECT p.legacy_id, 'brand' AS reason, 4 AS rank
    FROM public.products p
    WHERE p.is_published AND p.brand IS NOT NULL AND lower(p.brand) LIKE '%'||v_q||'%'
    UNION
    SELECT a.legacy_id, 'generic' AS reason, 9 AS rank
    FROM approved a WHERE a.generic_name IS NOT NULL AND lower(a.generic_name) LIKE '%'||v_q||'%'
    UNION
    SELECT a.legacy_id, 'active_ingredient' AS reason, 9 AS rank
    FROM approved a WHERE a.active_ingredient IS NOT NULL AND lower(a.active_ingredient) LIKE '%'||v_q||'%'
    UNION
    SELECT a.legacy_id, 'drug_class' AS reason, 7 AS rank
    FROM approved a WHERE a.pharmacological_class IS NOT NULL AND lower(a.pharmacological_class) LIKE '%'||v_q||'%'
    UNION
    SELECT a.legacy_id, 'condition' AS reason, 10 AS rank
    FROM approved a, unnest(a.conditions) cond
    WHERE lower(cond) LIKE '%'||v_q||'%'
    UNION
    SELECT a.legacy_id, 'category' AS reason, 6 AS rank
    FROM approved a
    WHERE a.therapeutic_category IS NOT NULL
      AND lower(public._therapeutic_label_ar(a.therapeutic_category::text)) LIKE '%'||v_q||'%'
  ), ranked AS (
    SELECT legacy_id, max(rank) AS best_rank, array_agg(DISTINCT reason) AS reasons
    FROM matches
    GROUP BY legacy_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'legacy_id', r.legacy_id, 'reasons', r.reasons, 'rank', r.best_rank
  ) ORDER BY r.best_rank DESC, r.legacy_id), '[]'::jsonb) INTO v
  FROM ranked r
  LIMIT 200;
  RETURN COALESCE(v,'[]'::jsonb);
END $$;

-- Homepage sections: one bucket per therapeutic_category with >= 1 approved product.
CREATE OR REPLACE FUNCTION public.pharmacy_homepage_sections()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  WITH per_cat AS (
    SELECT c.therapeutic_category::text AS cat,
           array_agg(c.product_legacy_id ORDER BY c.confidence DESC, c.product_legacy_id) AS ids,
           count(*) AS n
    FROM public.product_classifications c
    JOIN public.products p ON p.legacy_id = c.product_legacy_id AND p.is_published
    WHERE c.status = 'approved' AND c.therapeutic_category IS NOT NULL
    GROUP BY c.therapeutic_category
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'category', cat,
    'label', public._therapeutic_label_ar(cat),
    'count', n,
    'legacy_ids', (SELECT array_agg(x) FROM unnest(ids[1:12]) x)
  ) ORDER BY n DESC), '[]'::jsonb) INTO v
  FROM per_cat
  WHERE n >= 2;
  RETURN COALESCE(v,'[]'::jsonb);
END $$;

-- Related products engine.
CREATE OR REPLACE FUNCTION public.pharmacy_related_products(_legacy_id int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cat public.therapeutic_category;
  v_class text;
  v_conds text[];
  v_related int[];
  v_comp int[];
  v_same_cond jsonb; v_same_class jsonb; v_explicit jsonb; v_copurchase jsonb;
BEGIN
  SELECT therapeutic_category, pharmacological_class, conditions,
         related_legacy_ids, complementary_legacy_ids
    INTO v_cat, v_class, v_conds, v_related, v_comp
  FROM public.product_classifications
  WHERE product_legacy_id = _legacy_id AND status='approved';

  -- Same condition (any overlap)
  IF v_conds IS NOT NULL AND array_length(v_conds,1) > 0 THEN
    SELECT COALESCE(jsonb_agg(legacy_id), '[]'::jsonb) INTO v_same_cond FROM (
      SELECT DISTINCT c.product_legacy_id AS legacy_id
      FROM public.product_classifications c
      JOIN public.products p ON p.legacy_id = c.product_legacy_id AND p.is_published
      WHERE c.status='approved' AND c.product_legacy_id <> _legacy_id
        AND c.conditions && v_conds
      LIMIT 8
    ) s;
  ELSE v_same_cond := '[]'::jsonb; END IF;

  -- Same drug class
  IF v_class IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(legacy_id), '[]'::jsonb) INTO v_same_class FROM (
      SELECT c.product_legacy_id AS legacy_id
      FROM public.product_classifications c
      JOIN public.products p ON p.legacy_id = c.product_legacy_id AND p.is_published
      WHERE c.status='approved' AND c.product_legacy_id <> _legacy_id
        AND lower(c.pharmacological_class) = lower(v_class)
      LIMIT 8
    ) s;
  ELSE v_same_class := '[]'::jsonb; END IF;

  -- Explicit related + complementary from classification arrays
  SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO v_explicit
  FROM (
    SELECT DISTINCT x FROM unnest(COALESCE(v_related,'{}'::int[]) || COALESCE(v_comp,'{}'::int[])) x
    JOIN public.products p ON p.legacy_id = x AND p.is_published
    LIMIT 8
  ) s;

  -- Frequently bought together: from orders.items
  SELECT COALESCE(jsonb_agg(legacy_id), '[]'::jsonb) INTO v_copurchase FROM (
    SELECT (it2->>'id')::int AS legacy_id, count(*) AS n
    FROM public.orders o,
         jsonb_array_elements(o.items) it1,
         jsonb_array_elements(o.items) it2
    WHERE o.created_at >= now() - interval '180 days'
      AND o.status <> 'cancelled'
      AND (it1->>'id')::int = _legacy_id
      AND (it2->>'id')::int <> _legacy_id
    GROUP BY (it2->>'id')::int
    ORDER BY n DESC
    LIMIT 8
  ) s;

  RETURN jsonb_build_object(
    'same_condition', v_same_cond,
    'same_class', v_same_class,
    'explicit', v_explicit,
    'copurchase', v_copurchase
  );
END $$;

-- Chronic legacy ids (public)
CREATE OR REPLACE FUNCTION public.pharmacy_chronic_legacy_ids()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(c.product_legacy_id), '[]'::jsonb)
  FROM public.product_classifications c
  JOIN public.products p ON p.legacy_id = c.product_legacy_id AND p.is_published
  WHERE c.status='approved' AND c.is_chronic = true;
$$;

-- Grants for anon (these are read-only, used by public storefront)
GRANT EXECUTE ON FUNCTION public.pharmacy_search(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pharmacy_homepage_sections() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pharmacy_related_products(int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pharmacy_chronic_legacy_ids() TO anon, authenticated;

-- Seed CHRONIC10 discount code (idempotent)
INSERT INTO public.discount_codes (code, kind, value, active, min_total, max_uses, first_order_only, starts_at)
VALUES ('CHRONIC10', 'percent', 10, true, 0, NULL, false, now())
ON CONFLICT (code) DO NOTHING;
