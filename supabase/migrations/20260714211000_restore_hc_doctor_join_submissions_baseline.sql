-- Restore the doctor onboarding table that predated the tracked additive
-- healthcare migrations in the original Supabase project.
DO $$
BEGIN
  CREATE TYPE public.hc_join_status AS ENUM (
    'new', 'reviewing', 'approved', 'rejected', 'duplicate'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public.hc_doctor_join_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitter_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name_ar text NOT NULL,
  full_name_en text,
  normalized_name_ar text NOT NULL,
  title text,
  biography text,
  phone text NOT NULL,
  phone_e164 text NOT NULL,
  email text,
  city text,
  governorate text,
  claimed_specialties text[] NOT NULL DEFAULT ARRAY[]::text[],
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  practice_wishlist jsonb NOT NULL DEFAULT '[]'::jsonb,
  status public.hc_join_status NOT NULL DEFAULT 'new',
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_notes text,
  decision_at timestamptz,
  duplicate_of uuid REFERENCES public.hc_doctors(id) ON DELETE SET NULL,
  duplicate_score numeric NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hc_join_submissions_status
  ON public.hc_doctor_join_submissions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hc_join_submissions_submitter
  ON public.hc_doctor_join_submissions (submitter_user_id);
CREATE INDEX IF NOT EXISTS idx_hc_join_submissions_phone
  ON public.hc_doctor_join_submissions (phone_e164);

GRANT INSERT ON public.hc_doctor_join_submissions TO anon, authenticated;
GRANT SELECT ON public.hc_doctor_join_submissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hc_doctor_join_submissions TO service_role;

ALTER TABLE public.hc_doctor_join_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "join anon insert"
  ON public.hc_doctor_join_submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'new'::public.hc_join_status
    AND reviewer_id IS NULL
    AND decision_at IS NULL
    AND duplicate_score = 0
    AND length(full_name_ar) BETWEEN 2 AND 200
    AND length(normalized_name_ar) BETWEEN 2 AND 200
    AND length(phone) BETWEEN 5 AND 40
    AND length(phone_e164) BETWEEN 5 AND 20
  );

CREATE POLICY "join submitter read"
  ON public.hc_doctor_join_submissions
  FOR SELECT
  TO authenticated
  USING (submitter_user_id = auth.uid());

CREATE POLICY "join admin manage"
  ON public.hc_doctor_join_submissions
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_hc_doctor_join_submissions_updated
  BEFORE UPDATE ON public.hc_doctor_join_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
