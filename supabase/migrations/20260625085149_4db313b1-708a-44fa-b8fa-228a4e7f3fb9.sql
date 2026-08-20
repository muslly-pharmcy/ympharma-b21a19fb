
-- Schedule run_all_agents_now() every 12 hours (08:51 and 20:51 UTC)
DO $$
BEGIN
  PERFORM cron.unschedule('run-all-agents-12h') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='run-all-agents-12h');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'run-all-agents-12h',
  '51 8,20 * * *',
  $$SELECT public.run_all_agents_now();$$
);

-- Trigger one immediate run now
SELECT public.run_all_agents_now();
