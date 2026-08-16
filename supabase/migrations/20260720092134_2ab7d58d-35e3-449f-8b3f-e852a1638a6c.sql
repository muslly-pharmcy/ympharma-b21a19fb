-- ============================================================
-- Phase 4 — Shipment C1: Patient & Doctor Domain
-- ============================================================

-- 1) Extend hc_patients
ALTER TABLE public.hc_patients
  ADD COLUMN IF NOT EXISTS mrn TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS blood_type TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS merged_into_id UUID REFERENCES public.hc_patients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by UUID;

CREATE UNIQUE INDEX IF NOT EXISTS hc_patients_org_mrn_uniq
  ON public.hc_patients(organization_id, mrn) WHERE mrn IS NOT NULL;
CREATE INDEX IF NOT EXISTS hc_patients_org_active_idx
  ON public.hc_patients(organization_id, is_active);
CREATE INDEX IF NOT EXISTS hc_patients_name_trgm_idx
  ON public.hc_patients USING gin (full_name gin_trgm_ops);

-- 2) MRN generator
CREATE OR REPLACE FUNCTION public.generate_mrn(p_org UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count BIGINT;
  v_prefix TEXT := to_char(now(), 'YYYYMMDD');
BEGIN
  SELECT COUNT(*) + 1 INTO v_count
    FROM public.hc_patients
   WHERE organization_id = p_org
     AND mrn LIKE 'MRN-' || v_prefix || '-%';
  RETURN 'MRN-' || v_prefix || '-' || lpad(v_count::text, 5, '0');
END;
$$;
REVOKE ALL ON FUNCTION public.generate_mrn(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_mrn(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.hc_patients_assign_mrn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.mrn IS NULL AND NEW.organization_id IS NOT NULL THEN
    NEW.mrn := public.generate_mrn(NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hc_patients_assign_mrn ON public.hc_patients;
CREATE TRIGGER trg_hc_patients_assign_mrn
  BEFORE INSERT ON public.hc_patients
  FOR EACH ROW EXECUTE FUNCTION public.hc_patients_assign_mrn();

-- 3) patient_allergies
CREATE TABLE IF NOT EXISTS public.patient_allergies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.hc_patients(id) ON DELETE CASCADE,
  allergen TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'moderate' CHECK (severity IN ('mild','moderate','severe','life_threatening')),
  reaction TEXT,
  notes TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS patient_allergies_patient_idx ON public.patient_allergies(patient_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_allergies TO authenticated;
GRANT ALL ON public.patient_allergies TO service_role;
ALTER TABLE public.patient_allergies ENABLE ROW LEVEL SECURITY;

CREATE POLICY pa_read ON public.patient_allergies FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.hc_patients p
    WHERE p.id = patient_allergies.patient_id
      AND p.organization_id IS NOT NULL
      AND public.has_org_permission(auth.uid(), p.organization_id, 'healthcare.patients.read')
  ));
CREATE POLICY pa_manage ON public.patient_allergies FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.hc_patients p
    WHERE p.id = patient_allergies.patient_id
      AND p.organization_id IS NOT NULL
      AND public.has_org_permission(auth.uid(), p.organization_id, 'healthcare.patients.manage')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.hc_patients p
    WHERE p.id = patient_allergies.patient_id
      AND p.organization_id IS NOT NULL
      AND public.has_org_permission(auth.uid(), p.organization_id, 'healthcare.patients.manage')
  ));

-- 4) patient_conditions
CREATE TABLE IF NOT EXISTS public.patient_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.hc_patients(id) ON DELETE CASCADE,
  condition_name TEXT NOT NULL,
  icd10 TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','resolved','remission','chronic')),
  onset_date DATE,
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS patient_conditions_patient_idx ON public.patient_conditions(patient_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_conditions TO authenticated;
GRANT ALL ON public.patient_conditions TO service_role;
ALTER TABLE public.patient_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY pc_read ON public.patient_conditions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.hc_patients p
    WHERE p.id = patient_conditions.patient_id
      AND p.organization_id IS NOT NULL
      AND public.has_org_permission(auth.uid(), p.organization_id, 'healthcare.patients.read')
  ));
CREATE POLICY pc_manage ON public.patient_conditions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.hc_patients p
    WHERE p.id = patient_conditions.patient_id
      AND p.organization_id IS NOT NULL
      AND public.has_org_permission(auth.uid(), p.organization_id, 'healthcare.patients.manage')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.hc_patients p
    WHERE p.id = patient_conditions.patient_id
      AND p.organization_id IS NOT NULL
      AND public.has_org_permission(auth.uid(), p.organization_id, 'healthcare.patients.manage')
  ));

-- 5) patient_emergency_contacts
CREATE TABLE IF NOT EXISTS public.patient_emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.hc_patients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relation TEXT,
  phone TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pec_patient_idx ON public.patient_emergency_contacts(patient_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_emergency_contacts TO authenticated;
GRANT ALL ON public.patient_emergency_contacts TO service_role;
ALTER TABLE public.patient_emergency_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY pec_read ON public.patient_emergency_contacts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.hc_patients p
    WHERE p.id = patient_emergency_contacts.patient_id
      AND p.organization_id IS NOT NULL
      AND public.has_org_permission(auth.uid(), p.organization_id, 'healthcare.patients.read')
  ));
CREATE POLICY pec_manage ON public.patient_emergency_contacts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.hc_patients p
    WHERE p.id = patient_emergency_contacts.patient_id
      AND p.organization_id IS NOT NULL
      AND public.has_org_permission(auth.uid(), p.organization_id, 'healthcare.patients.manage')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.hc_patients p
    WHERE p.id = patient_emergency_contacts.patient_id
      AND p.organization_id IS NOT NULL
      AND public.has_org_permission(auth.uid(), p.organization_id, 'healthcare.patients.manage')
  ));

-- 6) hc_doctor_licenses
CREATE TABLE IF NOT EXISTS public.hc_doctor_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.hc_doctors(id) ON DELETE CASCADE,
  license_number TEXT NOT NULL,
  authority TEXT,
  country TEXT,
  valid_from DATE,
  valid_to DATE,
  document_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','suspended','revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hcl_doctor_idx ON public.hc_doctor_licenses(doctor_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hc_doctor_licenses TO authenticated;
GRANT ALL ON public.hc_doctor_licenses TO service_role;
ALTER TABLE public.hc_doctor_licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY dl_read ON public.hc_doctor_licenses FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.hc_doctors d
    WHERE d.id = hc_doctor_licenses.doctor_id
      AND (
        (d.organization_id IS NOT NULL AND public.is_org_member(d.organization_id, auth.uid()))
        OR d.user_id = auth.uid()
      )
  ));
CREATE POLICY dl_manage ON public.hc_doctor_licenses FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.hc_doctors d
    WHERE d.id = hc_doctor_licenses.doctor_id
      AND d.organization_id IS NOT NULL
      AND public.has_org_permission(auth.uid(), d.organization_id, 'healthcare.doctors.manage')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.hc_doctors d
    WHERE d.id = hc_doctor_licenses.doctor_id
      AND d.organization_id IS NOT NULL
      AND public.has_org_permission(auth.uid(), d.organization_id, 'healthcare.doctors.manage')
  ));

-- 7) updated_at triggers
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at_now') THEN
    CREATE OR REPLACE FUNCTION public.set_updated_at_now()
    RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $f$
    BEGIN NEW.updated_at = now(); RETURN NEW; END; $f$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_pa_updated') THEN
    CREATE TRIGGER trg_pa_updated BEFORE UPDATE ON public.patient_allergies
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_pc_updated') THEN
    CREATE TRIGGER trg_pc_updated BEFORE UPDATE ON public.patient_conditions
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_pec_updated') THEN
    CREATE TRIGGER trg_pec_updated BEFORE UPDATE ON public.patient_emergency_contacts
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_dl_updated') THEN
    CREATE TRIGGER trg_dl_updated BEFORE UPDATE ON public.hc_doctor_licenses
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
  END IF;
END $$;