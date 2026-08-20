
-- Therapeutic category enum
DO $$ BEGIN
  CREATE TYPE public.therapeutic_category AS ENUM (
    'diabetes','hypertension','cardiology','allergy','asthma','gi',
    'antibiotics','neurology','dermatology','pediatrics','womens_health',
    'vitamins','pain','respiratory','ophthalmology','urology','hormonal',
    'oncology','mental_health','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.classification_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) Table
CREATE TABLE IF NOT EXISTS public.product_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_legacy_id int NOT NULL UNIQUE,
  generic_name text,
  active_ingredient text,
  therapeutic_category public.therapeutic_category,
  pharmacological_class text,
  conditions text[] NOT NULL DEFAULT '{}',
  is_chronic boolean NOT NULL DEFAULT false,
  requires_prescription boolean NOT NULL DEFAULT false,
  related_legacy_ids int[] NOT NULL DEFAULT '{}',
  complementary_legacy_ids int[] NOT NULL DEFAULT '{}',
  confidence int NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 100),
  status public.classification_status NOT NULL DEFAULT 'pending',
  ai_model text,
  ai_raw jsonb,
  reviewer_id uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) GRANTS (required by Data API)
GRANT SELECT ON public.product_classifications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_classifications TO authenticated;
GRANT ALL ON public.product_classifications TO service_role;

-- 3) RLS
ALTER TABLE public.product_classifications ENABLE ROW LEVEL SECURITY;

-- Public: only approved rows visible
CREATE POLICY "public read approved classifications"
  ON public.product_classifications FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');

-- Staff with products perm / admin / owner: full read
CREATE POLICY "staff read all classifications"
  ON public.product_classifications FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(),'owner')
    OR public.has_role(auth.uid(),'admin')
    OR public.has_permission(auth.uid(),'products')
  );

CREATE POLICY "staff write classifications"
  ON public.product_classifications FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(),'owner')
    OR public.has_role(auth.uid(),'admin')
    OR public.has_permission(auth.uid(),'products')
  )
  WITH CHECK (
    public.has_role(auth.uid(),'owner')
    OR public.has_role(auth.uid(),'admin')
    OR public.has_permission(auth.uid(),'products')
  );

-- Indexes for search
CREATE INDEX IF NOT EXISTS idx_classif_status ON public.product_classifications(status);
CREATE INDEX IF NOT EXISTS idx_classif_category ON public.product_classifications(therapeutic_category) WHERE status='approved';
CREATE INDEX IF NOT EXISTS idx_classif_chronic ON public.product_classifications(is_chronic) WHERE status='approved';
CREATE INDEX IF NOT EXISTS idx_classif_active_ing ON public.product_classifications(lower(active_ingredient));
CREATE INDEX IF NOT EXISTS idx_classif_conditions ON public.product_classifications USING gin(conditions);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_classif_touch ON public.product_classifications;
CREATE TRIGGER trg_classif_touch BEFORE UPDATE ON public.product_classifications
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) RPC helpers

-- Admin/staff guard
CREATE OR REPLACE FUNCTION public._classif_can_manage() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(),'owner')
    OR public.has_role(auth.uid(),'admin')
    OR public.has_permission(auth.uid(),'products')
  );
$$;

-- List for admin review queue with optional status filter + search
CREATE OR REPLACE FUNCTION public.list_classifications_admin(
  _status text DEFAULT NULL,
  _category text DEFAULT NULL,
  _limit int DEFAULT 100
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public._classif_can_manage() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'created_at') DESC), '[]'::jsonb) INTO v FROM (
    SELECT jsonb_build_object(
      'id', c.id, 'product_legacy_id', c.product_legacy_id,
      'product_name', p.name, 'brand', p.brand, 'image_url', p.image_url,
      'generic_name', c.generic_name, 'active_ingredient', c.active_ingredient,
      'therapeutic_category', c.therapeutic_category,
      'pharmacological_class', c.pharmacological_class,
      'conditions', c.conditions, 'is_chronic', c.is_chronic,
      'requires_prescription', c.requires_prescription,
      'confidence', c.confidence, 'status', c.status,
      'related_legacy_ids', c.related_legacy_ids,
      'complementary_legacy_ids', c.complementary_legacy_ids,
      'ai_model', c.ai_model,
      'created_at', c.created_at, 'reviewed_at', c.reviewed_at
    ) AS t
    FROM public.product_classifications c
    LEFT JOIN public.products p ON p.legacy_id = c.product_legacy_id
    WHERE (_status IS NULL OR c.status::text = _status)
      AND (_category IS NULL OR c.therapeutic_category::text = _category)
    ORDER BY c.created_at DESC
    LIMIT GREATEST(1, LEAST(_limit, 500))
  ) s;
  RETURN COALESCE(v,'[]'::jsonb);
END $$;

-- Upsert from AI batch (staff)
CREATE OR REPLACE FUNCTION public.upsert_classification(_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_legacy int;
BEGIN
  IF NOT public._classif_can_manage() THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_legacy := (_payload->>'product_legacy_id')::int;
  IF v_legacy IS NULL THEN RAISE EXCEPTION 'missing_product_legacy_id'; END IF;

  INSERT INTO public.product_classifications (
    product_legacy_id, generic_name, active_ingredient, therapeutic_category,
    pharmacological_class, conditions, is_chronic, requires_prescription,
    related_legacy_ids, complementary_legacy_ids, confidence, status, ai_model, ai_raw
  ) VALUES (
    v_legacy,
    NULLIF(_payload->>'generic_name',''),
    NULLIF(_payload->>'active_ingredient',''),
    NULLIF(_payload->>'therapeutic_category','')::public.therapeutic_category,
    NULLIF(_payload->>'pharmacological_class',''),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(_payload->'conditions','[]'::jsonb))), '{}'),
    COALESCE((_payload->>'is_chronic')::boolean, false),
    COALESCE((_payload->>'requires_prescription')::boolean, false),
    COALESCE(ARRAY(SELECT (jsonb_array_elements_text(COALESCE(_payload->'related_legacy_ids','[]'::jsonb)))::int), '{}'),
    COALESCE(ARRAY(SELECT (jsonb_array_elements_text(COALESCE(_payload->'complementary_legacy_ids','[]'::jsonb)))::int), '{}'),
    COALESCE((_payload->>'confidence')::int, 0),
    COALESCE(NULLIF(_payload->>'status','')::public.classification_status, 'pending'),
    NULLIF(_payload->>'ai_model',''),
    _payload->'ai_raw'
  )
  ON CONFLICT (product_legacy_id) DO UPDATE SET
    generic_name = EXCLUDED.generic_name,
    active_ingredient = EXCLUDED.active_ingredient,
    therapeutic_category = EXCLUDED.therapeutic_category,
    pharmacological_class = EXCLUDED.pharmacological_class,
    conditions = EXCLUDED.conditions,
    is_chronic = EXCLUDED.is_chronic,
    requires_prescription = EXCLUDED.requires_prescription,
    related_legacy_ids = EXCLUDED.related_legacy_ids,
    complementary_legacy_ids = EXCLUDED.complementary_legacy_ids,
    confidence = EXCLUDED.confidence,
    ai_model = EXCLUDED.ai_model,
    ai_raw = EXCLUDED.ai_raw,
    -- Do not overwrite an approved row back to pending automatically
    status = CASE WHEN public.product_classifications.status = 'approved'
                  THEN public.product_classifications.status
                  ELSE EXCLUDED.status END,
    updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Approve
CREATE OR REPLACE FUNCTION public.approve_classification(_id uuid, _edits jsonb DEFAULT '{}'::jsonb)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public._classif_can_manage() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.product_classifications SET
    generic_name = COALESCE(NULLIF(_edits->>'generic_name',''), generic_name),
    active_ingredient = COALESCE(NULLIF(_edits->>'active_ingredient',''), active_ingredient),
    therapeutic_category = COALESCE(NULLIF(_edits->>'therapeutic_category','')::public.therapeutic_category, therapeutic_category),
    pharmacological_class = COALESCE(NULLIF(_edits->>'pharmacological_class',''), pharmacological_class),
    conditions = CASE WHEN _edits ? 'conditions'
                      THEN ARRAY(SELECT jsonb_array_elements_text(_edits->'conditions'))
                      ELSE conditions END,
    is_chronic = COALESCE((_edits->>'is_chronic')::boolean, is_chronic),
    requires_prescription = COALESCE((_edits->>'requires_prescription')::boolean, requires_prescription),
    status = 'approved',
    reviewer_id = auth.uid(),
    reviewed_at = now()
  WHERE id = _id;
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.reject_classification(_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public._classif_can_manage() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.product_classifications SET
    status='rejected', reviewer_id=auth.uid(), reviewed_at=now()
  WHERE id=_id;
  RETURN FOUND;
END $$;

-- Public list (storefront)
CREATE OR REPLACE FUNCTION public.list_approved_classifications_public()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'product_legacy_id', c.product_legacy_id,
    'generic_name', c.generic_name,
    'active_ingredient', c.active_ingredient,
    'therapeutic_category', c.therapeutic_category,
    'pharmacological_class', c.pharmacological_class,
    'conditions', c.conditions,
    'is_chronic', c.is_chronic,
    'requires_prescription', c.requires_prescription
  )), '[]'::jsonb)
  FROM public.product_classifications c
  WHERE c.status = 'approved';
$$;

-- Stats for admin dashboard
CREATE OR REPLACE FUNCTION public.pharmacy_taxonomy_stats()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total int; v_pending int; v_approved int; v_rejected int; v_unclassified int; v_by_cat jsonb;
BEGIN
  IF NOT public._classif_can_manage() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT count(*) INTO v_total FROM public.products WHERE is_published;
  SELECT count(*) FILTER (WHERE status='pending'),
         count(*) FILTER (WHERE status='approved'),
         count(*) FILTER (WHERE status='rejected')
    INTO v_pending, v_approved, v_rejected
    FROM public.product_classifications;
  SELECT count(*) INTO v_unclassified
    FROM public.products p
    WHERE p.is_published
      AND NOT EXISTS (SELECT 1 FROM public.product_classifications c WHERE c.product_legacy_id = p.legacy_id);
  SELECT COALESCE(jsonb_object_agg(therapeutic_category::text, n), '{}'::jsonb) INTO v_by_cat FROM (
    SELECT therapeutic_category, count(*) AS n
    FROM public.product_classifications
    WHERE status='approved' AND therapeutic_category IS NOT NULL
    GROUP BY therapeutic_category
  ) t;
  RETURN jsonb_build_object(
    'products_total', v_total,
    'pending', v_pending,
    'approved', v_approved,
    'rejected', v_rejected,
    'unclassified', v_unclassified,
    'by_category', v_by_cat
  );
END $$;
