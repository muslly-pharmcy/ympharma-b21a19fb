-- Column-level lockdown for public doctor rows.
-- RLS cannot restrict columns, so revoke the table grant and re-grant per column.
REVOKE SELECT ON public.hc_doctors FROM anon, authenticated;

-- anon: everything except qr_token and phone_e164
GRANT SELECT (
  id, organization_id, user_id, slug, full_name_ar, full_name_en, title, bio_ar, bio_en,
  photo_url, years_experience, languages, gender, verification_status, verified_at, verified_by,
  rejection_reason, is_public, metadata, created_at, updated_at, academic_title, medical_title,
  sub_specialties, certificates, awards, services, accepted_insurance, consultation_fee_min,
  consultation_fee_max, currency, gallery, intro_video_url, seo_title_ar, seo_desc_ar,
  telemedicine_ready, emergency_available, profile_completeness, trust_score, last_verified_at,
  source, confidence_score, normalized_name_ar
) ON public.hc_doctors TO anon;

-- authenticated: same, plus phone_e164 (staff/directory), still no qr_token
GRANT SELECT (
  id, organization_id, user_id, slug, full_name_ar, full_name_en, title, bio_ar, bio_en,
  photo_url, years_experience, languages, gender, verification_status, verified_at, verified_by,
  rejection_reason, is_public, metadata, created_at, updated_at, academic_title, medical_title,
  sub_specialties, certificates, awards, services, accepted_insurance, consultation_fee_min,
  consultation_fee_max, currency, gallery, intro_video_url, seo_title_ar, seo_desc_ar,
  telemedicine_ready, emergency_available, profile_completeness, trust_score, last_verified_at,
  source, confidence_score, normalized_name_ar, phone_e164
) ON public.hc_doctors TO authenticated;

GRANT ALL ON public.hc_doctors TO service_role;