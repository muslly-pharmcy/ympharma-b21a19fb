
-- ============== Insurance claims ==============
CREATE TABLE public.insurance_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insurance_company text NOT NULL DEFAULT 'المتخصصة للتأمين',
  insurance_number text NOT NULL,
  patient_name text NOT NULL,
  patient_phone text NOT NULL,
  card_image_url text,
  card_expiry date,
  prescription_image_url text,
  prescription_date date,
  diagnosis text,
  is_stamped boolean DEFAULT false,
  channel text NOT NULL DEFAULT 'web' CHECK (channel IN ('web','whatsapp')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','needs_info','fulfilled')),
  validation_notes text,
  staff_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.insurance_claims TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurance_claims TO authenticated;
GRANT ALL ON public.insurance_claims TO service_role;

ALTER TABLE public.insurance_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone submit insurance claim"
  ON public.insurance_claims FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "staff read insurance claims"
  ON public.insurance_claims FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')
    OR public.has_permission(auth.uid(),'prescriptions')
    OR public.has_permission(auth.uid(),'orders')
  );

CREATE POLICY "staff update insurance claims"
  ON public.insurance_claims FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')
    OR public.has_permission(auth.uid(),'prescriptions')
  );

CREATE POLICY "owner admin delete insurance claims"
  ON public.insurance_claims FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_insurance_claims_updated_at
  BEFORE UPDATE ON public.insurance_claims
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_insurance_claims_created ON public.insurance_claims(created_at DESC);
CREATE INDEX idx_insurance_claims_status ON public.insurance_claims(status);

-- ============== Alert dedupe (cooldown) ==============
CREATE TABLE public.alert_dedupe (
  alert_key text PRIMARY KEY,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  count int NOT NULL DEFAULT 1
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_dedupe TO authenticated;
GRANT ALL ON public.alert_dedupe TO service_role;

ALTER TABLE public.alert_dedupe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read alert dedupe"
  ON public.alert_dedupe FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

-- ============== Archive tables ==============
CREATE TABLE public.error_logs_archive (LIKE public.error_logs INCLUDING ALL);
ALTER TABLE public.error_logs_archive ADD COLUMN archived_at timestamptz NOT NULL DEFAULT now();
GRANT SELECT ON public.error_logs_archive TO authenticated;
GRANT ALL ON public.error_logs_archive TO service_role;
ALTER TABLE public.error_logs_archive ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read error archive"
  ON public.error_logs_archive FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.uptime_incidents_archive (LIKE public.uptime_incidents INCLUDING ALL);
ALTER TABLE public.uptime_incidents_archive ADD COLUMN archived_at timestamptz NOT NULL DEFAULT now();
GRANT SELECT ON public.uptime_incidents_archive TO authenticated;
GRANT ALL ON public.uptime_incidents_archive TO service_role;
ALTER TABLE public.uptime_incidents_archive ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read incidents archive"
  ON public.uptime_incidents_archive FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

-- ============== Retention function ==============
CREATE OR REPLACE FUNCTION public.run_retention_policy()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_err_archived int := 0;
  v_err_purged int := 0;
  v_inc_archived int := 0;
  v_inc_purged int := 0;
  v_checks_purged int := 0;
BEGIN
  WITH moved AS (
    DELETE FROM public.error_logs
    WHERE occurred_at < now() - interval '30 days'
    RETURNING *
  ), ins AS (
    INSERT INTO public.error_logs_archive
    SELECT *, now() FROM moved
    RETURNING 1
  )
  SELECT count(*) INTO v_err_archived FROM ins;

  DELETE FROM public.error_logs_archive WHERE archived_at < now() - interval '180 days';
  GET DIAGNOSTICS v_err_purged = ROW_COUNT;

  WITH moved AS (
    DELETE FROM public.uptime_incidents
    WHERE ended_at IS NOT NULL AND ended_at < now() - interval '90 days'
    RETURNING *
  ), ins AS (
    INSERT INTO public.uptime_incidents_archive
    SELECT *, now() FROM moved
    RETURNING 1
  )
  SELECT count(*) INTO v_inc_archived FROM ins;

  DELETE FROM public.uptime_incidents_archive WHERE archived_at < now() - interval '365 days';
  GET DIAGNOSTICS v_inc_purged = ROW_COUNT;

  DELETE FROM public.uptime_checks WHERE checked_at < now() - interval '30 days';
  GET DIAGNOSTICS v_checks_purged = ROW_COUNT;

  RETURN jsonb_build_object(
    'error_logs_archived', v_err_archived,
    'error_logs_archive_purged', v_err_purged,
    'incidents_archived', v_inc_archived,
    'incidents_archive_purged', v_inc_purged,
    'uptime_checks_purged', v_checks_purged,
    'ran_at', now()
  );
END; $$;

-- ============== Daily cron at 00:00 UTC ==============
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$ BEGIN
  PERFORM cron.unschedule('retention-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('retention-daily', '0 0 * * *', $$ SELECT public.run_retention_policy(); $$);

-- ============== Storage RLS for insurance bucket ==============
CREATE POLICY "anyone uploads insurance"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'insurance');

CREATE POLICY "staff reads insurance"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'insurance' AND (
      public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')
      OR public.has_permission(auth.uid(),'prescriptions')
    )
  );

CREATE POLICY "owner admin manage insurance"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'insurance' AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'))
  )
  WITH CHECK (
    bucket_id = 'insurance' AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'))
  );
