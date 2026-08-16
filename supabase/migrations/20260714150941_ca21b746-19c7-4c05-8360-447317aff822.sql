
-- helper (idempotent create)
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ---- Enums ----
DO $$ BEGIN CREATE TYPE public.hc_location_kind AS ENUM ('clinic','hospital','medical_center','pharmacy_clinic');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.hc_verification_status AS ENUM ('pending','verified','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.hc_appointment_status AS ENUM ('requested','confirmed','completed','cancelled','no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.hc_specialty_status AS ENUM ('active','inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.hc_emit_event(_name text, _entity_type text, _entity_id uuid, _payload jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.agent_events (event_name, entity_type, entity_id, payload)
  VALUES (_name, _entity_type, _entity_id, COALESCE(_payload, '{}'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.hc_emit_event(text,text,uuid,jsonb) FROM PUBLIC, anon;

-- hc_specialties
CREATE TABLE IF NOT EXISTS public.hc_specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL, name_en text NOT NULL,
  description_ar text, description_en text,
  status public.hc_specialty_status NOT NULL DEFAULT 'active',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hc_specialties TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hc_specialties TO authenticated;
GRANT ALL ON public.hc_specialties TO service_role;
ALTER TABLE public.hc_specialties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "specialties_public_read" ON public.hc_specialties FOR SELECT USING (status = 'active');
CREATE POLICY "specialties_admin_all" ON public.hc_specialties FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_hc_specialties_updated BEFORE UPDATE ON public.hc_specialties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- hc_locations
CREATE TABLE IF NOT EXISTS public.hc_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  kind public.hc_location_kind NOT NULL,
  name_ar text NOT NULL, name_en text,
  address text, city text, governorate text,
  country text NOT NULL DEFAULT 'YE',
  lat numeric(9,6), lng numeric(9,6),
  phone text, email text, whatsapp text,
  working_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hc_locations_org ON public.hc_locations(organization_id, is_active);
GRANT SELECT ON public.hc_locations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hc_locations TO authenticated;
GRANT ALL ON public.hc_locations TO service_role;
ALTER TABLE public.hc_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "locations_public_read" ON public.hc_locations FOR SELECT USING (is_active = true);
CREATE POLICY "locations_org_manage" ON public.hc_locations FOR ALL TO authenticated
  USING (public.has_org_permission(auth.uid(), organization_id, 'healthcare.locations.manage'))
  WITH CHECK (public.has_org_permission(auth.uid(), organization_id, 'healthcare.locations.manage'));
CREATE TRIGGER trg_hc_locations_updated BEFORE UPDATE ON public.hc_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- hc_doctors
CREATE TABLE IF NOT EXISTS public.hc_doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  slug text NOT NULL UNIQUE,
  full_name_ar text NOT NULL, full_name_en text,
  title text, bio_ar text, bio_en text, photo_url text,
  years_experience int CHECK (years_experience IS NULL OR years_experience >= 0),
  languages text[] NOT NULL DEFAULT ARRAY[]::text[],
  gender text CHECK (gender IS NULL OR gender IN ('male','female','other')),
  verification_status public.hc_verification_status NOT NULL DEFAULT 'pending',
  verified_at timestamptz, verified_by uuid, rejection_reason text,
  is_public boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hc_doctors_org ON public.hc_doctors(organization_id);
CREATE INDEX IF NOT EXISTS idx_hc_doctors_public ON public.hc_doctors(verification_status, is_public);
GRANT SELECT ON public.hc_doctors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hc_doctors TO authenticated;
GRANT ALL ON public.hc_doctors TO service_role;
ALTER TABLE public.hc_doctors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doctors_public_read" ON public.hc_doctors FOR SELECT
  USING (is_public = true AND verification_status = 'verified');
CREATE POLICY "doctors_org_read" ON public.hc_doctors FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "doctors_self_read" ON public.hc_doctors FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "doctors_org_manage" ON public.hc_doctors FOR ALL TO authenticated
  USING (organization_id IS NOT NULL AND public.has_org_permission(auth.uid(), organization_id, 'healthcare.doctors.manage'))
  WITH CHECK (organization_id IS NOT NULL AND public.has_org_permission(auth.uid(), organization_id, 'healthcare.doctors.manage'));
CREATE POLICY "doctors_self_update" ON public.hc_doctors FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_hc_doctors_updated BEFORE UPDATE ON public.hc_doctors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.hc_doctors_guard_verify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
     OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
     OR NEW.is_public IS DISTINCT FROM OLD.is_public THEN
    IF NEW.organization_id IS NULL
       OR NOT public.has_org_permission(auth.uid(), NEW.organization_id, 'healthcare.doctors.verify') THEN
      RAISE EXCEPTION 'insufficient privilege to modify verification fields';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_hc_doctors_guard BEFORE UPDATE ON public.hc_doctors
  FOR EACH ROW EXECUTE FUNCTION public.hc_doctors_guard_verify();

-- hc_doctor_specialties
CREATE TABLE IF NOT EXISTS public.hc_doctor_specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES public.hc_doctors(id) ON DELETE CASCADE,
  specialty_id uuid NOT NULL REFERENCES public.hc_specialties(id) ON DELETE RESTRICT,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doctor_id, specialty_id)
);
GRANT SELECT ON public.hc_doctor_specialties TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hc_doctor_specialties TO authenticated;
GRANT ALL ON public.hc_doctor_specialties TO service_role;
ALTER TABLE public.hc_doctor_specialties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ds_public_read" ON public.hc_doctor_specialties FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.hc_doctors d WHERE d.id = doctor_id
          AND ((d.is_public AND d.verification_status='verified')
               OR (d.organization_id IS NOT NULL AND public.is_org_member(d.organization_id, auth.uid()))
               OR d.user_id = auth.uid())));
CREATE POLICY "ds_manage" ON public.hc_doctor_specialties FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hc_doctors d WHERE d.id = doctor_id
    AND d.organization_id IS NOT NULL AND public.has_org_permission(auth.uid(), d.organization_id, 'healthcare.doctors.manage')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hc_doctors d WHERE d.id = doctor_id
    AND d.organization_id IS NOT NULL AND public.has_org_permission(auth.uid(), d.organization_id, 'healthcare.doctors.manage')));

-- hc_doctor_qualifications
CREATE TABLE IF NOT EXISTS public.hc_doctor_qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES public.hc_doctors(id) ON DELETE CASCADE,
  title text NOT NULL, institution text,
  year int CHECK (year IS NULL OR (year BETWEEN 1900 AND 2100)),
  country text, document_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hc_doctor_qualifications TO authenticated;
GRANT ALL ON public.hc_doctor_qualifications TO service_role;
ALTER TABLE public.hc_doctor_qualifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dq_read" ON public.hc_doctor_qualifications FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.hc_doctors d WHERE d.id = doctor_id
          AND ((d.organization_id IS NOT NULL AND public.is_org_member(d.organization_id, auth.uid()))
               OR d.user_id = auth.uid())));
CREATE POLICY "dq_manage" ON public.hc_doctor_qualifications FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hc_doctors d WHERE d.id = doctor_id
    AND d.organization_id IS NOT NULL AND public.has_org_permission(auth.uid(), d.organization_id, 'healthcare.doctors.manage')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hc_doctors d WHERE d.id = doctor_id
    AND d.organization_id IS NOT NULL AND public.has_org_permission(auth.uid(), d.organization_id, 'healthcare.doctors.manage')));
CREATE TRIGGER trg_hc_dq_updated BEFORE UPDATE ON public.hc_doctor_qualifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- hc_doctor_locations
CREATE TABLE IF NOT EXISTS public.hc_doctor_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES public.hc_doctors(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.hc_locations(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'consultant' CHECK (role IN ('consultant','resident','visiting','owner')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doctor_id, location_id)
);
GRANT SELECT ON public.hc_doctor_locations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hc_doctor_locations TO authenticated;
GRANT ALL ON public.hc_doctor_locations TO service_role;
ALTER TABLE public.hc_doctor_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dl_public_read" ON public.hc_doctor_locations FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.hc_doctors d WHERE d.id = doctor_id
          AND ((d.is_public AND d.verification_status='verified')
               OR (d.organization_id IS NOT NULL AND public.is_org_member(d.organization_id, auth.uid()))
               OR d.user_id = auth.uid())));
CREATE POLICY "dl_manage" ON public.hc_doctor_locations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hc_doctors d WHERE d.id = doctor_id
    AND d.organization_id IS NOT NULL AND public.has_org_permission(auth.uid(), d.organization_id, 'healthcare.doctors.manage')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hc_doctors d WHERE d.id = doctor_id
    AND d.organization_id IS NOT NULL AND public.has_org_permission(auth.uid(), d.organization_id, 'healthcare.doctors.manage')));

-- hc_doctor_availability
CREATE TABLE IF NOT EXISTS public.hc_doctor_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES public.hc_doctors(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.hc_locations(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL, end_time time NOT NULL,
  slot_duration_minutes int NOT NULL DEFAULT 30 CHECK (slot_duration_minutes > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
GRANT SELECT ON public.hc_doctor_availability TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hc_doctor_availability TO authenticated;
GRANT ALL ON public.hc_doctor_availability TO service_role;
ALTER TABLE public.hc_doctor_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "av_public_read" ON public.hc_doctor_availability FOR SELECT USING (
  is_active AND EXISTS (SELECT 1 FROM public.hc_doctors d WHERE d.id = doctor_id
    AND ((d.is_public AND d.verification_status='verified')
         OR (d.organization_id IS NOT NULL AND public.is_org_member(d.organization_id, auth.uid()))
         OR d.user_id = auth.uid())));
CREATE POLICY "av_manage" ON public.hc_doctor_availability FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hc_doctors d WHERE d.id = doctor_id
    AND (d.user_id = auth.uid()
         OR (d.organization_id IS NOT NULL AND public.has_org_permission(auth.uid(), d.organization_id, 'healthcare.doctors.manage')))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hc_doctors d WHERE d.id = doctor_id
    AND (d.user_id = auth.uid()
         OR (d.organization_id IS NOT NULL AND public.has_org_permission(auth.uid(), d.organization_id, 'healthcare.doctors.manage')))));
CREATE TRIGGER trg_hc_av_updated BEFORE UPDATE ON public.hc_doctor_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- hc_availability_blocks
CREATE TABLE IF NOT EXISTS public.hc_availability_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES public.hc_doctors(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.hc_locations(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
  reason text, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hc_availability_blocks TO authenticated;
GRANT ALL ON public.hc_availability_blocks TO service_role;
ALTER TABLE public.hc_availability_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "avb_read" ON public.hc_availability_blocks FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.hc_doctors d WHERE d.id = doctor_id
    AND (d.user_id = auth.uid()
         OR (d.organization_id IS NOT NULL AND public.is_org_member(d.organization_id, auth.uid())))));
CREATE POLICY "avb_manage" ON public.hc_availability_blocks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hc_doctors d WHERE d.id = doctor_id
    AND (d.user_id = auth.uid()
         OR (d.organization_id IS NOT NULL AND public.has_org_permission(auth.uid(), d.organization_id, 'healthcare.doctors.manage')))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hc_doctors d WHERE d.id = doctor_id
    AND (d.user_id = auth.uid()
         OR (d.organization_id IS NOT NULL AND public.has_org_permission(auth.uid(), d.organization_id, 'healthcare.doctors.manage')))));

-- hc_patients
CREATE TABLE IF NOT EXISTS public.hc_patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL, phone text,
  date_of_birth date CHECK (date_of_birth IS NULL OR date_of_birth <= CURRENT_DATE),
  gender text CHECK (gender IS NULL OR gender IN ('male','female','other')),
  national_id_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hc_patients_org ON public.hc_patients(organization_id);
CREATE INDEX IF NOT EXISTS idx_hc_patients_user ON public.hc_patients(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hc_patients TO authenticated;
GRANT ALL ON public.hc_patients TO service_role;
ALTER TABLE public.hc_patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patients_owner_read" ON public.hc_patients FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "patients_org_read" ON public.hc_patients FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND public.has_org_permission(auth.uid(), organization_id, 'healthcare.patients.read'));
CREATE POLICY "patients_org_manage" ON public.hc_patients FOR ALL TO authenticated
  USING (organization_id IS NOT NULL AND public.has_org_permission(auth.uid(), organization_id, 'healthcare.patients.manage'))
  WITH CHECK (organization_id IS NOT NULL AND public.has_org_permission(auth.uid(), organization_id, 'healthcare.patients.manage'));
CREATE POLICY "patients_self_write" ON public.hc_patients FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_hc_patients_updated BEFORE UPDATE ON public.hc_patients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- hc_appointments
CREATE TABLE IF NOT EXISTS public.hc_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.hc_locations(id) ON DELETE RESTRICT,
  doctor_id uuid NOT NULL REFERENCES public.hc_doctors(id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES public.hc_patients(id) ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
  status public.hc_appointment_status NOT NULL DEFAULT 'requested',
  reason text, notes text, created_by uuid,
  confirmed_at timestamptz, completed_at timestamptz,
  cancelled_at timestamptz, cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_hc_appt_doctor_time ON public.hc_appointments(doctor_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_hc_appt_patient ON public.hc_appointments(patient_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hc_appointments TO authenticated;
GRANT ALL ON public.hc_appointments TO service_role;
ALTER TABLE public.hc_appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appt_patient_read" ON public.hc_appointments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.hc_patients p WHERE p.id = patient_id AND p.user_id = auth.uid()));
CREATE POLICY "appt_doctor_read" ON public.hc_appointments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.hc_doctors d WHERE d.id = doctor_id AND d.user_id = auth.uid()));
CREATE POLICY "appt_org_read" ON public.hc_appointments FOR SELECT TO authenticated
  USING (public.has_org_permission(auth.uid(), organization_id, 'healthcare.appointments.read'));
CREATE POLICY "appt_org_manage" ON public.hc_appointments FOR ALL TO authenticated
  USING (public.has_org_permission(auth.uid(), organization_id, 'healthcare.appointments.manage'))
  WITH CHECK (public.has_org_permission(auth.uid(), organization_id, 'healthcare.appointments.manage'));
CREATE TRIGGER trg_hc_appt_updated BEFORE UPDATE ON public.hc_appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- hc_verification_requests
CREATE TABLE IF NOT EXISTS public.hc_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES public.hc_doctors(id) ON DELETE CASCADE,
  submitted_by uuid, documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  status public.hc_verification_status NOT NULL DEFAULT 'pending',
  reviewer_id uuid, review_notes text, reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hc_verification_requests TO authenticated;
GRANT ALL ON public.hc_verification_requests TO service_role;
ALTER TABLE public.hc_verification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vr_submitter_read" ON public.hc_verification_requests FOR SELECT TO authenticated
  USING (submitted_by = auth.uid()
         OR EXISTS (SELECT 1 FROM public.hc_doctors d WHERE d.id = doctor_id AND d.user_id = auth.uid()));
CREATE POLICY "vr_reviewer_all" ON public.hc_verification_requests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hc_doctors d WHERE d.id = doctor_id
    AND d.organization_id IS NOT NULL
    AND public.has_org_permission(auth.uid(), d.organization_id, 'healthcare.doctors.verify')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hc_doctors d WHERE d.id = doctor_id
    AND d.organization_id IS NOT NULL
    AND public.has_org_permission(auth.uid(), d.organization_id, 'healthcare.doctors.verify')));
CREATE POLICY "vr_submitter_insert" ON public.hc_verification_requests FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid());
CREATE TRIGGER trg_hc_vr_updated BEFORE UPDATE ON public.hc_verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PERMISSIONS SEED
INSERT INTO public.permissions (key, resource, action, description) VALUES
  ('healthcare.doctors.read',      'healthcare.doctors',      'read',   'Read doctor profiles in organization'),
  ('healthcare.doctors.manage',    'healthcare.doctors',      'manage', 'Create/update doctor profiles'),
  ('healthcare.doctors.verify',    'healthcare.doctors',      'verify', 'Approve or reject doctor verification'),
  ('healthcare.locations.manage',  'healthcare.locations',    'manage', 'Manage healthcare locations'),
  ('healthcare.patients.read',     'healthcare.patients',     'read',   'Read patient records'),
  ('healthcare.patients.manage',   'healthcare.patients',     'manage', 'Manage patient records'),
  ('healthcare.appointments.read',   'healthcare.appointments','read',   'Read appointments'),
  ('healthcare.appointments.create', 'healthcare.appointments','create', 'Create appointments'),
  ('healthcare.appointments.manage', 'healthcare.appointments','manage', 'Manage/transition appointments')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_key) VALUES
  ('owner','healthcare.doctors.read'),('admin','healthcare.doctors.read'),
  ('manager','healthcare.doctors.read'),('pharmacist','healthcare.doctors.read'),('employee','healthcare.doctors.read'),
  ('owner','healthcare.doctors.manage'),('admin','healthcare.doctors.manage'),('manager','healthcare.doctors.manage'),
  ('owner','healthcare.doctors.verify'),('admin','healthcare.doctors.verify'),
  ('owner','healthcare.locations.manage'),('admin','healthcare.locations.manage'),('manager','healthcare.locations.manage'),
  ('owner','healthcare.patients.read'),('admin','healthcare.patients.read'),('manager','healthcare.patients.read'),('pharmacist','healthcare.patients.read'),
  ('owner','healthcare.patients.manage'),('admin','healthcare.patients.manage'),('manager','healthcare.patients.manage'),
  ('owner','healthcare.appointments.read'),('admin','healthcare.appointments.read'),('manager','healthcare.appointments.read'),('pharmacist','healthcare.appointments.read'),('employee','healthcare.appointments.read'),
  ('owner','healthcare.appointments.create'),('admin','healthcare.appointments.create'),('manager','healthcare.appointments.create'),('pharmacist','healthcare.appointments.create'),('employee','healthcare.appointments.create'),
  ('owner','healthcare.appointments.manage'),('admin','healthcare.appointments.manage'),('manager','healthcare.appointments.manage')
ON CONFLICT DO NOTHING;

-- RPCs
CREATE OR REPLACE FUNCTION public.hc_create_specialty(_code text, _name_ar text, _name_en text, _description_ar text DEFAULT NULL, _description_en text DEFAULT NULL, _sort_order int DEFAULT 0)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admin required'; END IF;
  INSERT INTO public.hc_specialties (code,name_ar,name_en,description_ar,description_en,sort_order)
  VALUES (_code,_name_ar,_name_en,_description_ar,_description_en,_sort_order) RETURNING id INTO _id;
  PERFORM public.hc_emit_event('SPECIALTY_CREATED','specialty',_id, jsonb_build_object('code',_code));
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.hc_create_specialty(text,text,text,text,text,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hc_create_specialty(text,text,text,text,text,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.hc_create_location(_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _org uuid;
BEGIN
  _org := (_payload->>'organization_id')::uuid;
  IF NOT public.has_org_permission(auth.uid(), _org, 'healthcare.locations.manage') THEN
    RAISE EXCEPTION 'insufficient privilege';
  END IF;
  INSERT INTO public.hc_locations (
    organization_id, branch_id, kind, name_ar, name_en, address, city, governorate, country,
    lat, lng, phone, email, whatsapp, working_hours, is_active, metadata
  ) VALUES (
    _org,
    NULLIF(_payload->>'branch_id','')::uuid,
    (_payload->>'kind')::public.hc_location_kind,
    _payload->>'name_ar', _payload->>'name_en', _payload->>'address', _payload->>'city',
    _payload->>'governorate', COALESCE(_payload->>'country','YE'),
    NULLIF(_payload->>'lat','')::numeric, NULLIF(_payload->>'lng','')::numeric,
    _payload->>'phone', _payload->>'email', _payload->>'whatsapp',
    COALESCE(_payload->'working_hours','{}'::jsonb),
    COALESCE((_payload->>'is_active')::boolean, true),
    COALESCE(_payload->'metadata','{}'::jsonb)
  ) RETURNING id INTO _id;
  PERFORM public.hc_emit_event('LOCATION_CREATED','location',_id, jsonb_build_object('organization_id',_org));
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.hc_create_location(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hc_create_location(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.hc_create_doctor(_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _org uuid;
BEGIN
  _org := NULLIF(_payload->>'organization_id','')::uuid;
  IF _org IS NOT NULL AND NOT public.has_org_permission(auth.uid(), _org, 'healthcare.doctors.manage') THEN
    RAISE EXCEPTION 'insufficient privilege';
  END IF;
  INSERT INTO public.hc_doctors (
    organization_id, user_id, slug, full_name_ar, full_name_en, title,
    bio_ar, bio_en, photo_url, years_experience, languages, gender, metadata
  ) VALUES (
    _org, NULLIF(_payload->>'user_id','')::uuid, _payload->>'slug',
    _payload->>'full_name_ar', _payload->>'full_name_en', _payload->>'title',
    _payload->>'bio_ar', _payload->>'bio_en', _payload->>'photo_url',
    NULLIF(_payload->>'years_experience','')::int,
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(_payload->'languages')), ARRAY[]::text[]),
    _payload->>'gender', COALESCE(_payload->'metadata','{}'::jsonb)
  ) RETURNING id INTO _id;
  PERFORM public.hc_emit_event('DOCTOR_CREATED','doctor',_id, jsonb_build_object('organization_id',_org,'slug',_payload->>'slug'));
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.hc_create_doctor(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hc_create_doctor(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.hc_submit_verification(_doctor uuid, _documents jsonb DEFAULT '[]'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _doc record;
BEGIN
  SELECT * INTO _doc FROM public.hc_doctors WHERE id = _doctor;
  IF NOT FOUND THEN RAISE EXCEPTION 'doctor not found'; END IF;
  IF _doc.user_id IS DISTINCT FROM auth.uid()
     AND (_doc.organization_id IS NULL
          OR NOT public.has_org_permission(auth.uid(), _doc.organization_id, 'healthcare.doctors.manage')) THEN
    RAISE EXCEPTION 'insufficient privilege';
  END IF;
  INSERT INTO public.hc_verification_requests (doctor_id, submitted_by, documents, status)
  VALUES (_doctor, auth.uid(), _documents, 'pending') RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.hc_submit_verification(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hc_submit_verification(uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.hc_verify_doctor(_doctor uuid, _decision public.hc_verification_status, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid;
BEGIN
  SELECT organization_id INTO _org FROM public.hc_doctors WHERE id = _doctor;
  IF _org IS NULL OR NOT public.has_org_permission(auth.uid(), _org, 'healthcare.doctors.verify') THEN
    RAISE EXCEPTION 'insufficient privilege';
  END IF;
  IF _decision NOT IN ('verified','rejected') THEN RAISE EXCEPTION 'invalid decision'; END IF;
  UPDATE public.hc_doctors
     SET verification_status = _decision,
         verified_at = CASE WHEN _decision='verified' THEN now() ELSE NULL END,
         verified_by = CASE WHEN _decision='verified' THEN auth.uid() ELSE NULL END,
         rejection_reason = CASE WHEN _decision='rejected' THEN _notes ELSE NULL END,
         is_public = CASE WHEN _decision='verified' THEN true ELSE false END
   WHERE id = _doctor;
  UPDATE public.hc_verification_requests
     SET status = _decision, reviewer_id = auth.uid(), review_notes = _notes, reviewed_at = now()
   WHERE doctor_id = _doctor AND status = 'pending';
  IF _decision='verified' THEN
    PERFORM public.hc_emit_event('DOCTOR_VERIFIED','doctor',_doctor, jsonb_build_object('reviewer',auth.uid()));
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.hc_verify_doctor(uuid,public.hc_verification_status,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hc_verify_doctor(uuid,public.hc_verification_status,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.hc_create_appointment(
  _doctor uuid, _location uuid, _patient uuid, _starts_at timestamptz, _duration_minutes int DEFAULT 30, _reason text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _ends timestamptz; _org uuid; _conflict int;
BEGIN
  _ends := _starts_at + make_interval(mins => _duration_minutes);
  SELECT organization_id INTO _org FROM public.hc_locations WHERE id = _location;
  IF _org IS NULL THEN RAISE EXCEPTION 'location not found'; END IF;
  IF NOT (public.has_org_permission(auth.uid(), _org, 'healthcare.appointments.create')
          OR EXISTS (SELECT 1 FROM public.hc_patients p WHERE p.id = _patient AND p.user_id = auth.uid())) THEN
    RAISE EXCEPTION 'insufficient privilege';
  END IF;
  IF EXISTS (SELECT 1 FROM public.hc_availability_blocks b
              WHERE b.doctor_id = _doctor
                AND tstzrange(b.starts_at, b.ends_at) && tstzrange(_starts_at, _ends)) THEN
    RAISE EXCEPTION 'doctor unavailable (blocked)';
  END IF;
  SELECT count(*) INTO _conflict FROM public.hc_appointments a
   WHERE a.doctor_id = _doctor AND a.status IN ('requested','confirmed')
     AND tstzrange(a.starts_at, a.ends_at) && tstzrange(_starts_at, _ends);
  IF _conflict > 0 THEN RAISE EXCEPTION 'slot conflicts with existing appointment'; END IF;
  INSERT INTO public.hc_appointments (organization_id, location_id, doctor_id, patient_id, starts_at, ends_at, reason, created_by)
  VALUES (_org, _location, _doctor, _patient, _starts_at, _ends, _reason, auth.uid()) RETURNING id INTO _id;
  PERFORM public.hc_emit_event('APPOINTMENT_CREATED','appointment',_id, jsonb_build_object('doctor_id',_doctor,'patient_id',_patient));
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.hc_create_appointment(uuid,uuid,uuid,timestamptz,int,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hc_create_appointment(uuid,uuid,uuid,timestamptz,int,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.hc_transition_appointment(_appt uuid, _new public.hc_appointment_status, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cur public.hc_appointment_status; _org uuid; _doctor_user uuid; _patient_user uuid;
BEGIN
  SELECT a.status, a.organization_id,
         (SELECT user_id FROM public.hc_doctors WHERE id = a.doctor_id),
         (SELECT user_id FROM public.hc_patients WHERE id = a.patient_id)
    INTO _cur, _org, _doctor_user, _patient_user
    FROM public.hc_appointments a WHERE a.id = _appt;
  IF _cur IS NULL THEN RAISE EXCEPTION 'appointment not found'; END IF;
  IF NOT (public.has_org_permission(auth.uid(), _org, 'healthcare.appointments.manage')
          OR _doctor_user = auth.uid()
          OR (_patient_user = auth.uid() AND _new = 'cancelled')) THEN
    RAISE EXCEPTION 'insufficient privilege';
  END IF;
  IF NOT (
    (_cur = 'requested' AND _new IN ('confirmed','cancelled'))
    OR (_cur = 'confirmed' AND _new IN ('completed','cancelled','no_show'))
  ) THEN
    RAISE EXCEPTION 'invalid transition % -> %', _cur, _new;
  END IF;
  UPDATE public.hc_appointments
     SET status = _new,
         confirmed_at = CASE WHEN _new='confirmed' THEN now() ELSE confirmed_at END,
         completed_at = CASE WHEN _new='completed' THEN now() ELSE completed_at END,
         cancelled_at = CASE WHEN _new='cancelled' THEN now() ELSE cancelled_at END,
         cancel_reason = CASE WHEN _new='cancelled' THEN _reason ELSE cancel_reason END
   WHERE id = _appt;
  PERFORM public.hc_emit_event('APPOINTMENT_STATUS_CHANGED','appointment',_appt, jsonb_build_object('from',_cur::text,'to',_new::text));
END $$;
REVOKE ALL ON FUNCTION public.hc_transition_appointment(uuid,public.hc_appointment_status,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hc_transition_appointment(uuid,public.hc_appointment_status,text) TO authenticated;

-- Seed default specialties
INSERT INTO public.hc_specialties (code, name_ar, name_en, sort_order) VALUES
  ('internal_medicine','الباطنة العامة','Internal Medicine',10),
  ('pediatrics','طب الأطفال','Pediatrics',20),
  ('cardiology','أمراض القلب','Cardiology',30),
  ('dermatology','الجلدية','Dermatology',40),
  ('gynecology','النساء والولادة','Gynecology',50),
  ('dentistry','طب الأسنان','Dentistry',60),
  ('ophthalmology','الرمد','Ophthalmology',70),
  ('ent','الأنف والأذن والحنجرة','ENT',80),
  ('orthopedics','العظام','Orthopedics',90),
  ('psychiatry','الطب النفسي','Psychiatry',100)
ON CONFLICT (code) DO NOTHING;
