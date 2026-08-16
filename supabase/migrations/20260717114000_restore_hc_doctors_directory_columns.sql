-- Restore directory/profile columns that existed in the original healthcare
-- database before the later seed and reporting migrations were tracked.
ALTER TABLE public.hc_doctors
  ADD COLUMN IF NOT EXISTS academic_title text,
  ADD COLUMN IF NOT EXISTS medical_title text,
  ADD COLUMN IF NOT EXISTS normalized_name_ar text,
  ADD COLUMN IF NOT EXISTS phone_e164 text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS confidence_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trust_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profile_completeness numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consultation_fee_min numeric,
  ADD COLUMN IF NOT EXISTS consultation_fee_max numeric,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'YER',
  ADD COLUMN IF NOT EXISTS accepted_insurance text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS sub_specialties text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS services jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS certificates jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS awards jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS gallery jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS intro_video_url text,
  ADD COLUMN IF NOT EXISTS emergency_available boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS telemedicine_ready boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS seo_title_ar text,
  ADD COLUMN IF NOT EXISTS seo_desc_ar text,
  ADD COLUMN IF NOT EXISTS qr_token text;

CREATE INDEX IF NOT EXISTS idx_hc_doctors_normalized_name_ar
  ON public.hc_doctors (normalized_name_ar);
CREATE INDEX IF NOT EXISTS idx_hc_doctors_source
  ON public.hc_doctors (source, is_public, verification_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hc_doctors_qr_token
  ON public.hc_doctors (qr_token)
  WHERE qr_token IS NOT NULL;

ALTER TABLE public.hc_doctors
  DROP CONSTRAINT IF EXISTS hc_doctors_fee_range_check;
ALTER TABLE public.hc_doctors
  ADD CONSTRAINT hc_doctors_fee_range_check
  CHECK (
    (consultation_fee_min IS NULL OR consultation_fee_min >= 0)
    AND (consultation_fee_max IS NULL OR consultation_fee_max >= 0)
    AND (
      consultation_fee_min IS NULL
      OR consultation_fee_max IS NULL
      OR consultation_fee_max >= consultation_fee_min
    )
  );
