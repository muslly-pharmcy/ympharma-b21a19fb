
-- 1) Safe view for public doctor directory (excludes phone_e164, qr_token, verified_by, rejection_reason, metadata, source, confidence_score, normalized_name_ar, seo_desc_ar)
CREATE OR REPLACE VIEW public.hc_doctors_public_safe
WITH (security_invoker = false) AS
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

-- 2) Drop the wide public-read policy on the base table so sensitive columns
--    (phone_e164, qr_token, etc.) are no longer reachable via anon/auth SELECT *.
DROP POLICY IF EXISTS doctors_public_read ON public.hc_doctors;

-- Note: doctors_org_read, doctors_org_manage, doctors_self_read, doctors_self_update remain.
