
DROP POLICY IF EXISTS "error_logs_insert_all" ON public.error_logs;
CREATE POLICY "error_logs_insert_constrained" ON public.error_logs
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    coalesce(level, 'error') IN ('debug','info','warn','error','fatal')
    AND coalesce(length(message), 0) <= 2000
    AND coalesce(length(stack), 0) <= 20000
    AND coalesce(length(url), 0) <= 2000
    AND coalesce(length(user_agent), 0) <= 1000
    AND coalesce(length(extra::text), 0) <= 8000
  );

DROP POLICY IF EXISTS "anyone submit insurance claim" ON public.insurance_claims;
CREATE POLICY "anyone_submit_insurance_claim_constrained" ON public.insurance_claims
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    coalesce(status, 'pending') = 'pending'
    AND length(coalesce(patient_name,'')) BETWEEN 2 AND 120
    AND length(coalesce(patient_phone,'')) BETWEEN 5 AND 30
    AND length(coalesce(insurance_number,'')) BETWEEN 2 AND 60
    AND length(coalesce(insurance_company,'')) <= 120
    AND length(coalesce(diagnosis,'')) <= 1000
    AND length(coalesce(card_image_url,'')) <= 1000
    AND length(coalesce(prescription_image_url,'')) <= 1000
    AND length(coalesce(validation_notes,'')) <= 2000
    AND length(coalesce(staff_notes,'')) <= 2000
  );

DROP POLICY IF EXISTS "anyone uploads insurance" ON storage.objects;
CREATE POLICY "anyone_uploads_insurance_constrained" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'insurance'
    AND lower(coalesce(metadata->>'mimetype','')) IN ('image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif','application/pdf')
    AND coalesce((metadata->>'size')::bigint, 0) <= 10485760
  );

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
