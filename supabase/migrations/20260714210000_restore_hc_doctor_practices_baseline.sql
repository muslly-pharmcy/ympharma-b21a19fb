-- Restore the practice table that existed in the original Supabase project
-- before the repository began tracking the later additive migrations.
DO $$
BEGIN
  CREATE TYPE public.hc_booking_method AS ENUM (
    'walk_in', 'phone', 'whatsapp', 'online', 'assistant'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.hc_practice_type AS ENUM (
    'gov_hospital', 'private_hospital', 'military_hospital',
    'teaching_hospital', 'clinic', 'medical_center', 'charity', 'ngo'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public.hc_doctor_practices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES public.hc_doctors(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.hc_locations(id) ON DELETE CASCADE,
  practice_type public.hc_practice_type NOT NULL DEFAULT 'clinic',
  booking_method public.hc_booking_method NOT NULL DEFAULT 'walk_in',
  phone text,
  whatsapp text,
  assistant_phone text,
  consultation_duration_min integer CHECK (
    consultation_duration_min IS NULL OR consultation_duration_min > 0
  ),
  working_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  gallery jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  is_primary boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doctor_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_hc_doctor_practices_doctor
  ON public.hc_doctor_practices (doctor_id, is_active);
CREATE INDEX IF NOT EXISTS idx_hc_doctor_practices_location
  ON public.hc_doctor_practices (location_id, is_active);

GRANT SELECT ON public.hc_doctor_practices TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hc_doctor_practices TO authenticated;
GRANT ALL ON public.hc_doctor_practices TO service_role;

ALTER TABLE public.hc_doctor_practices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "practices_public_read"
  ON public.hc_doctor_practices
  FOR SELECT
  USING (
    is_active
    AND EXISTS (
      SELECT 1
      FROM public.hc_doctors AS d
      WHERE d.id = doctor_id
        AND d.is_public
        AND d.verification_status = 'verified'
    )
  );

CREATE POLICY "practices_org_read"
  ON public.hc_doctor_practices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.hc_doctors AS d
      WHERE d.id = doctor_id
        AND (
          d.user_id = auth.uid()
          OR (
            d.organization_id IS NOT NULL
            AND public.is_org_member(d.organization_id, auth.uid())
          )
        )
    )
  );

CREATE POLICY "practices_org_manage"
  ON public.hc_doctor_practices
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.hc_doctors AS d
      WHERE d.id = doctor_id
        AND d.organization_id IS NOT NULL
        AND public.has_org_permission(
          auth.uid(),
          d.organization_id,
          'healthcare.doctors.manage'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.hc_doctors AS d
      WHERE d.id = doctor_id
        AND d.organization_id IS NOT NULL
        AND public.has_org_permission(
          auth.uid(),
          d.organization_id,
          'healthcare.doctors.manage'
        )
    )
  );

CREATE TRIGGER trg_hc_doctor_practices_updated
  BEFORE UPDATE ON public.hc_doctor_practices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
