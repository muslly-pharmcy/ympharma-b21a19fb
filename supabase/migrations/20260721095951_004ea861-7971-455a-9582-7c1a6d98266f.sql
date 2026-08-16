
-- Recreate view as SECURITY INVOKER to satisfy the linter
DROP VIEW IF EXISTS public.hc_doctors_public_safe;

CREATE VIEW public.hc_doctors_public_safe
WITH (security_invoker = true) AS
SELECT
  id, organization_id, slug,
  full_name_ar, full_name_en, title, academic_title, medical_title,
  bio_ar, bio_en, photo_url, years_experience, languages, gender,
  sub_specialties, certificates, awards, services, accepted_insurance,
  consultation_fee_min, consultation_fee_max, currency,
  gallery, intro_video_url, seo_title_ar,
  telemedicine_ready, emergency_available,
  profile_completeness, trust_score,
  verification_status, is_public,
  verified_at, last_verified_at,
  created_at, updated_at
FROM public.hc_doctors
WHERE is_public = true
  AND verification_status = 'verified'::hc_verification_status;

REVOKE ALL ON public.hc_doctors_public_safe FROM PUBLIC;
GRANT SELECT ON public.hc_doctors_public_safe TO anon, authenticated;

-- Restore public read policy so security_invoker view works, but rely on
-- column-level privileges to hide sensitive fields from anon/authenticated.
DROP POLICY IF EXISTS doctors_public_read ON public.hc_doctors;
CREATE POLICY doctors_public_read ON public.hc_doctors
  FOR SELECT
  USING (is_public = true AND verification_status = 'verified'::hc_verification_status);

-- Revoke ALL column privileges from anon/authenticated, then grant only safe columns.
REVOKE SELECT ON public.hc_doctors FROM anon, authenticated;

GRANT SELECT (
  id, organization_id, user_id, slug,
  full_name_ar, full_name_en, title, academic_title, medical_title,
  bio_ar, bio_en, photo_url, years_experience, languages, gender,
  sub_specialties, certificates, awards, services, accepted_insurance,
  consultation_fee_min, consultation_fee_max, currency,
  gallery, intro_video_url, seo_title_ar, seo_desc_ar,
  telemedicine_ready, emergency_available,
  profile_completeness, trust_score,
  verification_status, is_public,
  verified_at, last_verified_at,
  created_at, updated_at,
  rejection_reason, metadata, source, confidence_score, normalized_name_ar,
  organization_id
) ON public.hc_doctors TO authenticated;

-- Anonymous callers get an even narrower slice (no rejection_reason/metadata/source/etc.)
GRANT SELECT (
  id, organization_id, slug,
  full_name_ar, full_name_en, title, academic_title, medical_title,
  bio_ar, bio_en, photo_url, years_experience, languages, gender,
  sub_specialties, certificates, awards, services, accepted_insurance,
  consultation_fee_min, consultation_fee_max, currency,
  gallery, intro_video_url, seo_title_ar,
  telemedicine_ready, emergency_available,
  profile_completeness, trust_score,
  verification_status, is_public,
  verified_at, last_verified_at,
  created_at, updated_at
) ON public.hc_doctors TO anon;
