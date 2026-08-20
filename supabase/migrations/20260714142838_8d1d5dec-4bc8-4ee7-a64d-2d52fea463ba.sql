
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE public.catalog_status AS ENUM ('draft','pending_review','approved','rejected','archived');
CREATE TYPE public.catalog_media_kind AS ENUM ('primary','gallery','thumbnail','barcode');
CREATE TYPE public.catalog_media_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.catalog_alias_source AS ENUM ('manual','ocr','ai','import');
CREATE TYPE public.catalog_ai_signal_type AS ENUM ('ocr','barcode','image','invoice','prescription');

CREATE OR REPLACE FUNCTION public.catalog_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE TABLE public.catalog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.catalog_categories(id) ON DELETE SET NULL,
  slug text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);
GRANT SELECT ON public.catalog_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_categories TO authenticated;
GRANT ALL ON public.catalog_categories TO service_role;
ALTER TABLE public.catalog_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY cat_categories_read_global ON public.catalog_categories
  FOR SELECT TO anon, authenticated USING (organization_id IS NULL AND is_active);
CREATE POLICY cat_categories_read_org ON public.catalog_categories
  FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND public.is_org_member(organization_id, auth.uid()));
CREATE POLICY cat_categories_write ON public.catalog_categories
  FOR ALL TO authenticated
  USING (organization_id IS NOT NULL AND public.has_org_permission(auth.uid(), organization_id, 'catalog.write', NULL))
  WITH CHECK (organization_id IS NOT NULL AND public.has_org_permission(auth.uid(), organization_id, 'catalog.write', NULL));
CREATE TRIGGER trg_cat_categories_touch BEFORE UPDATE ON public.catalog_categories
  FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();

CREATE TABLE public.catalog_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.catalog_categories(id) ON DELETE SET NULL,
  name_ar text NOT NULL,
  name_en text,
  generic_name text,
  brand text,
  manufacturer text,
  barcode text,
  active_ingredients jsonb NOT NULL DEFAULT '[]'::jsonb,
  dosage_form text,
  strength text,
  description_ar text,
  description_en text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.catalog_status NOT NULL DEFAULT 'draft',
  is_public boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.catalog_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_products TO authenticated;
GRANT ALL ON public.catalog_products TO service_role;
ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY cat_products_public_read ON public.catalog_products
  FOR SELECT TO anon, authenticated USING (is_public AND status = 'approved');
CREATE POLICY cat_products_org_read ON public.catalog_products
  FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND public.is_org_member(organization_id, auth.uid()));
CREATE POLICY cat_products_write ON public.catalog_products
  FOR ALL TO authenticated
  USING (organization_id IS NOT NULL AND public.has_org_permission(auth.uid(), organization_id, 'catalog.write', NULL))
  WITH CHECK (organization_id IS NOT NULL AND public.has_org_permission(auth.uid(), organization_id, 'catalog.write', NULL));
CREATE INDEX idx_catalog_products_org_status ON public.catalog_products (organization_id, status);
CREATE INDEX idx_catalog_products_barcode ON public.catalog_products (barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_catalog_products_name_ar_trgm ON public.catalog_products USING gin (name_ar gin_trgm_ops);
CREATE INDEX idx_catalog_products_name_en_trgm ON public.catalog_products USING gin (name_en gin_trgm_ops);
CREATE INDEX idx_catalog_products_generic_trgm ON public.catalog_products USING gin (generic_name gin_trgm_ops);
CREATE TRIGGER trg_cat_products_touch BEFORE UPDATE ON public.catalog_products
  FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();

CREATE OR REPLACE FUNCTION public.catalog_normalize_ar(_t text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT lower(regexp_replace(
    translate(
      regexp_replace(coalesce(_t,''), '[\u064B-\u0652\u0670]', '', 'g'),
      'أإآٱىةؤئـ',
      'اااايهوي'
    ),
    '\s+', ' ', 'g'
  ));
$$;

CREATE TABLE public.catalog_product_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  alias text NOT NULL,
  alias_normalized text NOT NULL DEFAULT '',
  locale text NOT NULL DEFAULT 'ar' CHECK (locale IN ('ar','en','mixed')),
  source public.catalog_alias_source NOT NULL DEFAULT 'manual',
  confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.catalog_product_aliases TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_product_aliases TO authenticated;
GRANT ALL ON public.catalog_product_aliases TO service_role;
ALTER TABLE public.catalog_product_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY cat_alias_read ON public.catalog_product_aliases
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.catalog_products p WHERE p.id = product_id
      AND ((p.is_public AND p.status='approved') OR (auth.uid() IS NOT NULL AND public.is_org_member(p.organization_id, auth.uid()))))
  );
CREATE POLICY cat_alias_write ON public.catalog_product_aliases
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.catalog_products p WHERE p.id = product_id
    AND public.has_org_permission(auth.uid(), p.organization_id, 'catalog.write', NULL)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.catalog_products p WHERE p.id = product_id
    AND public.has_org_permission(auth.uid(), p.organization_id, 'catalog.write', NULL)));
CREATE INDEX idx_cat_alias_norm_trgm ON public.catalog_product_aliases USING gin (alias_normalized gin_trgm_ops);
CREATE INDEX idx_cat_alias_product ON public.catalog_product_aliases (product_id);

CREATE OR REPLACE FUNCTION public.catalog_alias_normalize_trg()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.alias_normalized := public.catalog_normalize_ar(NEW.alias);
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_cat_alias_norm BEFORE INSERT OR UPDATE ON public.catalog_product_aliases
  FOR EACH ROW EXECUTE FUNCTION public.catalog_alias_normalize_trg();

CREATE TABLE public.catalog_product_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  storage_bucket text NOT NULL DEFAULT 'catalog-media',
  storage_path text NOT NULL,
  kind public.catalog_media_kind NOT NULL DEFAULT 'gallery',
  width int, height int, bytes bigint, checksum text, mime text,
  status public.catalog_media_status NOT NULL DEFAULT 'pending',
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  sort_order int NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.catalog_product_media TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_product_media TO authenticated;
GRANT ALL ON public.catalog_product_media TO service_role;
ALTER TABLE public.catalog_product_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY cat_media_read ON public.catalog_product_media
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.catalog_products p WHERE p.id = product_id
      AND ((p.is_public AND p.status='approved' AND catalog_product_media.status='approved')
           OR (auth.uid() IS NOT NULL AND public.is_org_member(p.organization_id, auth.uid()))))
  );
CREATE POLICY cat_media_upload ON public.catalog_product_media
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.catalog_products p WHERE p.id = product_id
    AND public.has_org_permission(auth.uid(), p.organization_id, 'catalog.media.upload', NULL)));
CREATE POLICY cat_media_manage ON public.catalog_product_media
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.catalog_products p WHERE p.id = product_id
    AND public.has_org_permission(auth.uid(), p.organization_id, 'catalog.media.review', NULL)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.catalog_products p WHERE p.id = product_id
    AND public.has_org_permission(auth.uid(), p.organization_id, 'catalog.media.review', NULL)));
CREATE POLICY cat_media_delete ON public.catalog_product_media
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.catalog_products p WHERE p.id = product_id
    AND public.has_org_permission(auth.uid(), p.organization_id, 'catalog.write', NULL)));
CREATE INDEX idx_cat_media_product ON public.catalog_product_media (product_id, kind, status);
CREATE TRIGGER trg_cat_media_touch BEFORE UPDATE ON public.catalog_product_media
  FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();

CREATE TABLE public.catalog_barcodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  barcode text NOT NULL,
  symbology text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, barcode)
);
GRANT SELECT ON public.catalog_barcodes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_barcodes TO authenticated;
GRANT ALL ON public.catalog_barcodes TO service_role;
ALTER TABLE public.catalog_barcodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY cat_barcode_read ON public.catalog_barcodes
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.catalog_products p WHERE p.id = product_id
      AND ((p.is_public AND p.status='approved') OR (auth.uid() IS NOT NULL AND public.is_org_member(p.organization_id, auth.uid()))))
  );
CREATE POLICY cat_barcode_write ON public.catalog_barcodes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.catalog_products p WHERE p.id = product_id
    AND public.has_org_permission(auth.uid(), p.organization_id, 'catalog.write', NULL)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.catalog_products p WHERE p.id = product_id
    AND public.has_org_permission(auth.uid(), p.organization_id, 'catalog.write', NULL)));
CREATE INDEX idx_cat_barcodes_barcode ON public.catalog_barcodes (barcode);
CREATE TRIGGER trg_cat_barcodes_touch BEFORE UPDATE ON public.catalog_barcodes
  FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();

CREATE TABLE public.catalog_ai_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.catalog_products(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  signal_type public.catalog_ai_signal_type NOT NULL,
  source text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric,
  status text NOT NULL DEFAULT 'pending',
  correlation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.catalog_ai_signals TO authenticated;
GRANT ALL ON public.catalog_ai_signals TO service_role;
ALTER TABLE public.catalog_ai_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY cat_ai_read ON public.catalog_ai_signals
  FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND public.has_org_permission(auth.uid(), organization_id, 'catalog.read', NULL));
CREATE INDEX idx_cat_ai_org_type ON public.catalog_ai_signals (organization_id, signal_type, status);
CREATE TRIGGER trg_cat_ai_touch BEFORE UPDATE ON public.catalog_ai_signals
  FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();

-- Seed permissions (schema: key, resource, action, description)
INSERT INTO public.permissions (key, resource, action, description) VALUES
  ('catalog.read','catalog','read','Read catalog products'),
  ('catalog.write','catalog','write','Create/update catalog products'),
  ('catalog.verify','catalog','verify','Verify/approve catalog products'),
  ('catalog.media.upload','catalog.media','upload','Upload product media'),
  ('catalog.media.review','catalog.media','review','Approve/reject product media')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_key)
SELECT r::public.org_role, p FROM (VALUES
  ('owner','catalog.read'),('owner','catalog.write'),('owner','catalog.verify'),('owner','catalog.media.upload'),('owner','catalog.media.review'),
  ('admin','catalog.read'),('admin','catalog.write'),('admin','catalog.verify'),('admin','catalog.media.upload'),('admin','catalog.media.review'),
  ('manager','catalog.read'),('manager','catalog.write'),('manager','catalog.media.upload'),
  ('pharmacist','catalog.read'),
  ('doctor','catalog.read'),
  ('employee','catalog.read')
) AS v(r,p)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.catalog_search(_q text, _org_id uuid, _limit int DEFAULT 20)
RETURNS TABLE (id uuid, name_ar text, name_en text, generic_name text, brand text, score real)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH q AS (SELECT public.catalog_normalize_ar(_q) AS qn)
  SELECT p.id, p.name_ar, p.name_en, p.generic_name, p.brand,
    GREATEST(
      similarity(public.catalog_normalize_ar(p.name_ar), (SELECT qn FROM q)),
      similarity(public.catalog_normalize_ar(coalesce(p.name_en,'')), (SELECT qn FROM q)),
      similarity(public.catalog_normalize_ar(coalesce(p.generic_name,'')), (SELECT qn FROM q)),
      coalesce((SELECT max(similarity(a.alias_normalized,(SELECT qn FROM q)))
                FROM public.catalog_product_aliases a WHERE a.product_id=p.id),0)
    ) AS score
  FROM public.catalog_products p
  WHERE (
      (_org_id IS NOT NULL AND p.organization_id = _org_id AND public.is_org_member(_org_id, auth.uid()))
      OR (p.is_public AND p.status = 'approved')
    )
    AND length(_q) > 0
  ORDER BY score DESC NULLS LAST
  LIMIT COALESCE(_limit, 20);
$$;
REVOKE EXECUTE ON FUNCTION public.catalog_search(text,uuid,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalog_search(text,uuid,int) TO authenticated, service_role;

-- Audit + event triggers (agent_events uses event_name, no status column)
CREATE OR REPLACE FUNCTION public.catalog_products_audit_trg()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE ev text; BEGIN
  IF TG_OP = 'INSERT' THEN ev := 'PRODUCT_CREATED';
  ELSIF TG_OP = 'UPDATE' AND OLD.status <> NEW.status AND NEW.status = 'approved' THEN ev := 'PRODUCT_VERIFIED';
  ELSIF TG_OP = 'UPDATE' THEN ev := 'PRODUCT_UPDATED';
  END IF;
  IF ev IS NOT NULL THEN
    INSERT INTO public.organization_audit_events (organization_id, actor_user_id, event_type, payload)
    VALUES (NEW.organization_id, auth.uid(), ev,
      jsonb_build_object('product_id', NEW.id, 'status', NEW.status, 'name_ar', NEW.name_ar));
    INSERT INTO public.agent_events (event_name, entity_type, entity_id, payload, source)
    VALUES (ev, 'catalog_product', NEW.id::text,
      jsonb_build_object('product_id', NEW.id, 'organization_id', NEW.organization_id), 'catalog_trigger');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_catalog_products_audit AFTER INSERT OR UPDATE ON public.catalog_products
  FOR EACH ROW EXECUTE FUNCTION public.catalog_products_audit_trg();

CREATE OR REPLACE FUNCTION public.catalog_media_audit_trg()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE org uuid; BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT organization_id INTO org FROM public.catalog_products WHERE id = NEW.product_id;
    INSERT INTO public.organization_audit_events (organization_id, actor_user_id, event_type, payload)
    VALUES (org, auth.uid(), 'PRODUCT_IMAGE_ADDED',
      jsonb_build_object('product_id', NEW.product_id, 'media_id', NEW.id, 'kind', NEW.kind));
    INSERT INTO public.agent_events (event_name, entity_type, entity_id, payload, source)
    VALUES ('PRODUCT_IMAGE_ADDED', 'catalog_product_media', NEW.id::text,
      jsonb_build_object('product_id', NEW.product_id, 'media_id', NEW.id), 'catalog_trigger');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_catalog_media_audit AFTER INSERT ON public.catalog_product_media
  FOR EACH ROW EXECUTE FUNCTION public.catalog_media_audit_trg();
