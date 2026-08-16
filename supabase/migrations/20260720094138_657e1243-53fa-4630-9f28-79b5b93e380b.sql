
-- Phase 4 Shipment C2: Prescription Engine (medical, non-dispensing)
CREATE TABLE public.hc_prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid NULL,
  patient_id uuid NOT NULL REFERENCES public.hc_patients(id) ON DELETE RESTRICT,
  doctor_id uuid NULL REFERENCES public.hc_doctors(id) ON DELETE SET NULL,
  external_doctor_name text NULL,
  prescription_no text NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','validated','approved','cancelled')),
  diagnosis text NULL,
  notes text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.hc_prescriptions (organization_id, status, issued_at DESC);
CREATE INDEX ON public.hc_prescriptions (patient_id);
CREATE INDEX ON public.hc_prescriptions (doctor_id);

CREATE TABLE public.hc_prescription_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES public.hc_prescriptions(id) ON DELETE CASCADE,
  product_id uuid NULL REFERENCES public.catalog_products(id) ON DELETE SET NULL,
  medication_name text NOT NULL,
  strength text NULL,
  form text NULL,
  dose text NULL,
  frequency text NULL,
  duration_days integer NULL,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  route text NULL,
  instructions text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.hc_prescription_items (prescription_id);

CREATE TABLE public.hc_prescription_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES public.hc_prescriptions(id) ON DELETE CASCADE,
  from_status text NULL,
  to_status text NOT NULL,
  changed_by uuid NULL,
  reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.hc_prescription_status_history (prescription_id, created_at);

CREATE TABLE public.hc_prescription_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES public.hc_prescriptions(id) ON DELETE CASCADE,
  author_id uuid NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.hc_prescription_notes (prescription_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hc_prescriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hc_prescription_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hc_prescription_status_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hc_prescription_notes TO authenticated;
GRANT ALL ON public.hc_prescriptions TO service_role;
GRANT ALL ON public.hc_prescription_items TO service_role;
GRANT ALL ON public.hc_prescription_status_history TO service_role;
GRANT ALL ON public.hc_prescription_notes TO service_role;

ALTER TABLE public.hc_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_prescription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_prescription_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_prescription_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY rx_read ON public.hc_prescriptions FOR SELECT TO authenticated
  USING (public.has_org_permission(auth.uid(), organization_id, 'prescription.read'));
CREATE POLICY rx_write ON public.hc_prescriptions FOR ALL TO authenticated
  USING (public.has_org_permission(auth.uid(), organization_id, 'prescription.write'))
  WITH CHECK (public.has_org_permission(auth.uid(), organization_id, 'prescription.write'));

CREATE POLICY rx_items_read ON public.hc_prescription_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hc_prescriptions p WHERE p.id = prescription_id
                 AND public.has_org_permission(auth.uid(), p.organization_id, 'prescription.read')));
CREATE POLICY rx_items_write ON public.hc_prescription_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hc_prescriptions p WHERE p.id = prescription_id
                 AND public.has_org_permission(auth.uid(), p.organization_id, 'prescription.write')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hc_prescriptions p WHERE p.id = prescription_id
                 AND public.has_org_permission(auth.uid(), p.organization_id, 'prescription.write')));

CREATE POLICY rx_hist_read ON public.hc_prescription_status_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hc_prescriptions p WHERE p.id = prescription_id
                 AND public.has_org_permission(auth.uid(), p.organization_id, 'prescription.read')));
CREATE POLICY rx_hist_write ON public.hc_prescription_status_history FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.hc_prescriptions p WHERE p.id = prescription_id
                 AND public.has_org_permission(auth.uid(), p.organization_id, 'prescription.write')));

CREATE POLICY rx_notes_read ON public.hc_prescription_notes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hc_prescriptions p WHERE p.id = prescription_id
                 AND public.has_org_permission(auth.uid(), p.organization_id, 'prescription.read')));
CREATE POLICY rx_notes_write ON public.hc_prescription_notes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hc_prescriptions p WHERE p.id = prescription_id
                 AND public.has_org_permission(auth.uid(), p.organization_id, 'prescription.write')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hc_prescriptions p WHERE p.id = prescription_id
                 AND public.has_org_permission(auth.uid(), p.organization_id, 'prescription.write')));

CREATE OR REPLACE FUNCTION public.tg_hc_rx_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER hc_prescriptions_updated_at BEFORE UPDATE ON public.hc_prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_hc_rx_updated_at();
