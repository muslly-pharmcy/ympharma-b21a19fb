
-- Slice 1: additive columns on hc_doctor_practices
ALTER TABLE public.hc_doctor_practices
  ADD COLUMN IF NOT EXISTS lat numeric(9,6),
  ADD COLUMN IF NOT EXISTS lng numeric(9,6),
  ADD COLUMN IF NOT EXISTS emergency_available boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS telemedicine_ready boolean NOT NULL DEFAULT false;

-- Slice 1: additive columns on hc_doctor_join_submissions
ALTER TABLE public.hc_doctor_join_submissions
  ADD COLUMN IF NOT EXISTS photo_review_status text
    CHECK (photo_review_status IS NULL OR photo_review_status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS photo_review_notes text,
  ADD COLUMN IF NOT EXISTS admin_notes text;

-- Reject RPC (mirrors approve pattern; admin-only)
CREATE OR REPLACE FUNCTION public.hc_reject_join_submission(_submission uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.hc_doctor_join_submissions
     SET status = 'rejected',
         reviewer_id = auth.uid(),
         decision_at = now(),
         reviewer_notes = COALESCE(_reason, reviewer_notes)
   WHERE id = _submission;
  IF NOT FOUND THEN RAISE EXCEPTION 'submission not found'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.hc_reject_join_submission(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hc_reject_join_submission(uuid, text) TO authenticated;

-- Flag photo review (admin-only)
CREATE OR REPLACE FUNCTION public.hc_flag_join_photo(_submission uuid, _status text, _notes text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _status NOT IN ('pending','approved','rejected') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;
  UPDATE public.hc_doctor_join_submissions
     SET photo_review_status = _status,
         photo_review_notes = _notes
   WHERE id = _submission;
  IF NOT FOUND THEN RAISE EXCEPTION 'submission not found'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.hc_flag_join_photo(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hc_flag_join_photo(uuid, text, text) TO authenticated;

-- Healthcare KPI view for admin hub (aggregate counters only, no PII)
CREATE OR REPLACE FUNCTION public.hc_healthcare_kpis()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT jsonb_build_object(
    'doctors_total',    (SELECT count(*) FROM public.hc_doctors),
    'doctors_verified', (SELECT count(*) FROM public.hc_doctors WHERE verification_status='verified'),
    'doctors_public',   (SELECT count(*) FROM public.hc_doctors WHERE is_public AND verification_status='verified'),
    'join_pending',     (SELECT count(*) FROM public.hc_doctor_join_submissions WHERE status IN ('new','reviewing')),
    'join_approved_7d', (SELECT count(*) FROM public.hc_doctor_join_submissions WHERE status='approved' AND decision_at > now() - interval '7 days'),
    'practices_active', (SELECT count(*) FROM public.hc_doctor_practices WHERE is_active),
    'appointments_7d',  (SELECT count(*) FROM public.hc_appointments WHERE created_at > now() - interval '7 days')
  ) INTO result;
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.hc_healthcare_kpis() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hc_healthcare_kpis() TO authenticated;
