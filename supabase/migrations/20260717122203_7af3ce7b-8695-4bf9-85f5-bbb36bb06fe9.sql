
-- ========== 1. patient_medications ==========
CREATE TABLE public.patient_medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.hc_patients(id) ON DELETE CASCADE,
  medicine_entity_id uuid REFERENCES public.medical_entities(id) ON DELETE SET NULL,
  medicine_name text NOT NULL,
  dosage text,
  frequency text,
  route text,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  active boolean NOT NULL DEFAULT true,
  notes text,
  prescribed_by_doctor_id uuid REFERENCES public.hc_doctors(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'self_reported' CHECK (source IN ('self_reported','prescription','doctor','import')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_patient_medications_patient ON public.patient_medications(patient_id) WHERE active;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_medications TO authenticated;
GRANT ALL ON public.patient_medications TO service_role;
ALTER TABLE public.patient_medications ENABLE ROW LEVEL SECURITY;

-- ========== 2. medical_vault_files ==========
CREATE TABLE public.medical_vault_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.hc_patients(id) ON DELETE CASCADE,
  file_type text NOT NULL CHECK (file_type IN ('prescription','scan','report','image','lab_result','certificate','other')),
  title text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  encryption_status boolean NOT NULL DEFAULT true,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_medical_vault_patient ON public.medical_vault_files(patient_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_vault_files TO authenticated;
GRANT ALL ON public.medical_vault_files TO service_role;
ALTER TABLE public.medical_vault_files ENABLE ROW LEVEL SECURITY;

-- ========== 3. family_health_accounts ==========
CREATE TABLE public.family_health_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_patient_id uuid NOT NULL REFERENCES public.hc_patients(id) ON DELETE CASCADE,
  member_patient_id uuid NOT NULL REFERENCES public.hc_patients(id) ON DELETE CASCADE,
  relationship text NOT NULL CHECK (relationship IN ('spouse','child','parent','sibling','guardian','other')),
  access_level text NOT NULL DEFAULT 'read' CHECK (access_level IN ('read','manage')),
  active boolean NOT NULL DEFAULT true,
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_patient_id, member_patient_id)
);
CREATE INDEX idx_family_owner ON public.family_health_accounts(owner_patient_id) WHERE active;
CREATE INDEX idx_family_member ON public.family_health_accounts(member_patient_id) WHERE active;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_health_accounts TO authenticated;
GRANT ALL ON public.family_health_accounts TO service_role;
ALTER TABLE public.family_health_accounts ENABLE ROW LEVEL SECURITY;

-- ========== 4. patient_consents ==========
CREATE TABLE public.patient_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.hc_patients(id) ON DELETE CASCADE,
  granted_to_type text NOT NULL CHECK (granted_to_type IN ('doctor','hospital','pharmacy','organization','family')),
  granted_to_id uuid NOT NULL,
  scope jsonb NOT NULL DEFAULT '[]'::jsonb,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_patient_consents_patient ON public.patient_consents(patient_id) WHERE active;
CREATE INDEX idx_patient_consents_grantee ON public.patient_consents(granted_to_type, granted_to_id) WHERE active;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_consents TO authenticated;
GRANT ALL ON public.patient_consents TO service_role;
ALTER TABLE public.patient_consents ENABLE ROW LEVEL SECURITY;

-- ========== 5. patient_health_events ==========
CREATE TABLE public.patient_health_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.hc_patients(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_date timestamptz NOT NULL DEFAULT now(),
  source_table text,
  source_id uuid,
  summary text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_health_events_patient_date ON public.patient_health_events(patient_id, event_date DESC);
GRANT SELECT, INSERT ON public.patient_health_events TO authenticated;
GRANT ALL ON public.patient_health_events TO service_role;
ALTER TABLE public.patient_health_events ENABLE ROW LEVEL SECURITY;

-- ========== Helper: does auth.uid() own or manage this patient? ==========
CREATE OR REPLACE FUNCTION public.patient_belongs_to_current_user(_patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hc_patients p
    WHERE p.id = _patient_id AND p.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.family_health_accounts fha
    JOIN public.hc_patients op ON op.id = fha.owner_patient_id
    WHERE fha.member_patient_id = _patient_id
      AND fha.active
      AND fha.access_level = 'manage'
      AND op.user_id = auth.uid()
  );
$$;
REVOKE EXECUTE ON FUNCTION public.patient_belongs_to_current_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.patient_belongs_to_current_user(uuid) TO authenticated, service_role;

-- ========== Policies ==========
CREATE POLICY "own_medications" ON public.patient_medications
  FOR ALL TO authenticated
  USING (public.patient_belongs_to_current_user(patient_id))
  WITH CHECK (public.patient_belongs_to_current_user(patient_id));

CREATE POLICY "own_vault" ON public.medical_vault_files
  FOR ALL TO authenticated
  USING (public.patient_belongs_to_current_user(patient_id))
  WITH CHECK (public.patient_belongs_to_current_user(patient_id));

CREATE POLICY "own_family_manage" ON public.family_health_accounts
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.hc_patients p WHERE p.id = owner_patient_id AND p.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.hc_patients p WHERE p.id = member_patient_id AND p.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.hc_patients p WHERE p.id = owner_patient_id AND p.user_id = auth.uid())
  );

CREATE POLICY "own_consents" ON public.patient_consents
  FOR ALL TO authenticated
  USING (public.patient_belongs_to_current_user(patient_id))
  WITH CHECK (public.patient_belongs_to_current_user(patient_id));

CREATE POLICY "own_timeline_read" ON public.patient_health_events
  FOR SELECT TO authenticated
  USING (public.patient_belongs_to_current_user(patient_id));

CREATE POLICY "own_timeline_insert" ON public.patient_health_events
  FOR INSERT TO authenticated
  WITH CHECK (public.patient_belongs_to_current_user(patient_id));

-- ========== updated_at triggers ==========
CREATE TRIGGER trg_patient_medications_updated BEFORE UPDATE ON public.patient_medications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_medical_vault_updated BEFORE UPDATE ON public.medical_vault_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_family_updated BEFORE UPDATE ON public.family_health_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_consents_updated BEFORE UPDATE ON public.patient_consents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== Timeline triggers ==========
CREATE OR REPLACE FUNCTION public.tg_med_to_timeline()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.patient_health_events (patient_id, event_type, event_date, source_table, source_id, summary, payload)
  VALUES (NEW.patient_id, 'MEDICATION_STARTED', NEW.start_date::timestamptz, 'patient_medications', NEW.id,
          'بدء دواء: ' || NEW.medicine_name,
          jsonb_build_object('medicine', NEW.medicine_name, 'dosage', NEW.dosage, 'frequency', NEW.frequency));
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_med_timeline AFTER INSERT ON public.patient_medications
  FOR EACH ROW EXECUTE FUNCTION public.tg_med_to_timeline();

CREATE OR REPLACE FUNCTION public.tg_vault_to_timeline()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.patient_health_events (patient_id, event_type, event_date, source_table, source_id, summary, payload)
  VALUES (NEW.patient_id, 'VAULT_FILE_UPLOADED', NEW.created_at, 'medical_vault_files', NEW.id,
          'رفع ملف: ' || NEW.title,
          jsonb_build_object('file_type', NEW.file_type, 'title', NEW.title));
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_vault_timeline AFTER INSERT ON public.medical_vault_files
  FOR EACH ROW EXECUTE FUNCTION public.tg_vault_to_timeline();

-- ========== Storage RLS on medical-vault bucket ==========
CREATE POLICY "vault_read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'medical-vault' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "vault_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'medical-vault' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "vault_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'medical-vault' AND (storage.foldername(name))[1] = auth.uid()::text);
