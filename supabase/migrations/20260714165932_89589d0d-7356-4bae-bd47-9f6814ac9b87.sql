
CREATE TYPE public.invoice_upload_status AS ENUM (
  'uploaded','extracting','extracted','failed','committed','cancelled'
);
CREATE TYPE public.invoice_upload_source AS ENUM ('camera','file');
CREATE TYPE public.invoice_line_status AS ENUM ('pending','confirmed','skipped');
CREATE TYPE public.invoice_match_source AS ENUM ('exact','alias','fuzzy','manual','unmatched');
CREATE TYPE public.invoice_audit_event_type AS ENUM (
  'uploaded','extraction_started','extraction_completed','extraction_failed',
  'line_reviewed','committed','cancelled'
);

CREATE TABLE public.invoice_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.sup_suppliers(id) ON DELETE SET NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  source public.invoice_upload_source NOT NULL DEFAULT 'camera',
  status public.invoice_upload_status NOT NULL DEFAULT 'uploaded',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_uploads TO authenticated;
GRANT ALL ON public.invoice_uploads TO service_role;
ALTER TABLE public.invoice_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY inv_up_org_read ON public.invoice_uploads
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY inv_up_write ON public.invoice_uploads
  FOR ALL TO authenticated
  USING (public.has_org_permission(auth.uid(), organization_id, 'inventory.write', NULL))
  WITH CHECK (public.has_org_permission(auth.uid(), organization_id, 'inventory.write', NULL));
CREATE INDEX idx_invoice_uploads_org_status ON public.invoice_uploads(organization_id, status);
CREATE INDEX idx_invoice_uploads_created ON public.invoice_uploads(created_at DESC);

CREATE TABLE public.invoice_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid NOT NULL REFERENCES public.invoice_uploads(id) ON DELETE CASCADE,
  supplier_name_raw text,
  invoice_number text,
  invoice_date date,
  currency text,
  subtotal numeric,
  tax numeric,
  total numeric,
  ocr_confidence numeric,
  raw_ocr_text text,
  model_used text,
  extracted_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_extractions TO authenticated;
GRANT ALL ON public.invoice_extractions TO service_role;
ALTER TABLE public.invoice_extractions ENABLE ROW LEVEL SECURITY;
CREATE POLICY inv_ext_org_read ON public.invoice_extractions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoice_uploads u
    WHERE u.id = upload_id AND public.is_org_member(u.organization_id, auth.uid())));
CREATE POLICY inv_ext_write ON public.invoice_extractions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoice_uploads u
    WHERE u.id = upload_id AND public.has_org_permission(auth.uid(), u.organization_id, 'inventory.write', NULL)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoice_uploads u
    WHERE u.id = upload_id AND public.has_org_permission(auth.uid(), u.organization_id, 'inventory.write', NULL)));
CREATE INDEX idx_invoice_extractions_upload ON public.invoice_extractions(upload_id);

CREATE TABLE public.invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_id uuid NOT NULL REFERENCES public.invoice_extractions(id) ON DELETE CASCADE,
  line_no int NOT NULL,
  raw_text text,
  detected_name text,
  detected_name_normalized text,
  quantity numeric,
  unit_cost numeric,
  unit_price numeric,
  expiry_date date,
  batch_number text,
  matched_product_id uuid REFERENCES public.catalog_products(id) ON DELETE SET NULL,
  match_confidence numeric,
  match_source public.invoice_match_source NOT NULL DEFAULT 'unmatched',
  user_confirmed_product_id uuid REFERENCES public.catalog_products(id) ON DELETE SET NULL,
  user_confirmed_qty numeric,
  user_confirmed_cost numeric,
  user_confirmed_expiry date,
  status public.invoice_line_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_line_items TO authenticated;
GRANT ALL ON public.invoice_line_items TO service_role;
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY inv_li_org_read ON public.invoice_line_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoice_extractions e
    JOIN public.invoice_uploads u ON u.id = e.upload_id
    WHERE e.id = extraction_id AND public.is_org_member(u.organization_id, auth.uid())));
CREATE POLICY inv_li_write ON public.invoice_line_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoice_extractions e
    JOIN public.invoice_uploads u ON u.id = e.upload_id
    WHERE e.id = extraction_id AND public.has_org_permission(auth.uid(), u.organization_id, 'inventory.write', NULL)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoice_extractions e
    JOIN public.invoice_uploads u ON u.id = e.upload_id
    WHERE e.id = extraction_id AND public.has_org_permission(auth.uid(), u.organization_id, 'inventory.write', NULL)));
CREATE INDEX idx_invoice_line_items_ext ON public.invoice_line_items(extraction_id, line_no);
CREATE INDEX idx_invoice_line_items_matched ON public.invoice_line_items(matched_product_id) WHERE matched_product_id IS NOT NULL;

CREATE TABLE public.invoice_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid NOT NULL REFERENCES public.invoice_uploads(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type public.invoice_audit_event_type NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.invoice_audit_events TO authenticated;
GRANT ALL ON public.invoice_audit_events TO service_role;
ALTER TABLE public.invoice_audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY inv_aud_org_read ON public.invoice_audit_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoice_uploads u
    WHERE u.id = upload_id AND public.is_org_member(u.organization_id, auth.uid())));
CREATE INDEX idx_invoice_audit_upload ON public.invoice_audit_events(upload_id, created_at DESC);

CREATE TRIGGER trg_invoice_uploads_touch BEFORE UPDATE ON public.invoice_uploads
  FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();
CREATE TRIGGER trg_invoice_line_items_touch BEFORE UPDATE ON public.invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();

-- Storage RLS. Path: <organization_id>/<upload_id>.<ext>
CREATE POLICY inv_storage_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'invoice-uploads'
    AND public.is_org_member((split_part(name, '/', 1))::uuid, auth.uid()));
CREATE POLICY inv_storage_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'invoice-uploads'
    AND public.has_org_permission(auth.uid(), (split_part(name, '/', 1))::uuid, 'inventory.write', NULL));
CREATE POLICY inv_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'invoice-uploads'
    AND public.has_org_permission(auth.uid(), (split_part(name, '/', 1))::uuid, 'inventory.write', NULL));
