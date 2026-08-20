
-- ============================================================
-- AUDIT-DB-003 — Lock down RBAC functions from PUBLIC
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.has_org_permission(uuid, uuid, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_org_permission(uuid, uuid, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated, service_role;

-- ============================================================
-- AUDIT-HC-006 — Remove duplicate marketing cron jobs
-- Keep the newer, standardized *-daily / *-weekly / *-4h jobs.
-- Drop the legacy duplicates.
-- ============================================================
DO $$
DECLARE dup_name text;
BEGIN
  FOREACH dup_name IN ARRAY ARRAY[
    'loyalty-reminder-campaign',   -- dup of run-loyalty-reminder-daily (jobid 23)
    'muslly-chronic-refills',      -- dup of chronic-refills-daily (jobid 14)
    'reactivation-campaign',       -- dup of run-reactivation-weekly (jobid 22)
    'restock-alerts'               -- dup of run-restock-alerts-4h (jobid 24)
  ] LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = dup_name) THEN
      PERFORM cron.unschedule(dup_name);
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- AUDIT-DB-001 — Fix prescription-extract-worker auth
-- The endpoint will be updated to accept x-cron-secret (standard),
-- so reschedule the job with the correct header.
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prescription-extract-worker') THEN
    PERFORM cron.unschedule('prescription-extract-worker');
  END IF;
END $$;

SELECT cron.schedule(
  'prescription-extract-worker',
  '* * * * *',
  $CRON$
  SELECT net.http_post(
    url := 'https://project--4d4aad01-9bf4-4d8b-acab-e51a06a17c63.lovable.app/api/public/hooks/prescription-extract?limit=5',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $CRON$
);
