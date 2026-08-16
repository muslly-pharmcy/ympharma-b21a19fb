
DO $$
BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job WHERE jobname = 'retention-and-idempotency-daily';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'retention-and-idempotency-daily',
  '30 3 * * *',
  $$ SELECT public.apply_retention_policies(); SELECT public.cleanup_idempotency_keys(); $$
);
