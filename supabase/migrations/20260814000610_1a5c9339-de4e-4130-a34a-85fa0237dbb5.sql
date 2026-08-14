CREATE TABLE public.patient_chronic_medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profile_id uuid REFERENCES public.family_health_profiles(id) ON DELETE SET NULL,
  medicine_name text NOT NULL,
  dose text,
  schedule_preset text NOT NULL DEFAULT 'يومياً',
  times_per_day smallint NOT NULL DEFAULT 1,
  start_date date,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pcm_schedule_preset_chk CHECK (schedule_preset IN ('قبل الطعام','بعد الطعام','يومياً','عند اللزوم')),
  CONSTRAINT pcm_times_chk CHECK (times_per_day BETWEEN 1 AND 12)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_chronic_medications TO authenticated;
GRANT ALL ON public.patient_chronic_medications TO service_role;

ALTER TABLE public.patient_chronic_medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pcm_owner_all" ON public.patient_chronic_medications
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pcm_staff_read" ON public.patient_chronic_medications
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE INDEX idx_pcm_user_active ON public.patient_chronic_medications (user_id, is_active);

CREATE TRIGGER trg_pcm_updated_at
  BEFORE UPDATE ON public.patient_chronic_medications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Clinical review read access for pharmacy staff on vault metadata (read-only).
CREATE POLICY "vault_staff_read" ON public.medical_vault_files
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));