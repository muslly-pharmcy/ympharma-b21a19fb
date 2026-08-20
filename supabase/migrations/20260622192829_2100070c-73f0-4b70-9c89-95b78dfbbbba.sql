-- Schedule marketing campaign webhooks via pg_cron.
-- The /api/public/* prefix bypasses edge auth; the route handlers verify the apikey header.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop any prior schedules with the same names (idempotent re-runs).
DO $$
BEGIN
  PERFORM cron.unschedule('run-reactivation-weekly');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('run-loyalty-reminder-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('run-restock-alerts-4h');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 1) Reactivation — every Monday at 09:00 UTC
SELECT cron.schedule(
  'run-reactivation-weekly',
  '0 9 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://project--4d4aad01-9bf4-4d8b-acab-e51a06a17c63.lovable.app/api/public/hooks/run-reactivation',
    headers := jsonb_build_object('Content-Type','application/json','apikey','sb_publishable_t5XgSgu8VR1zrm4DTF5_lQ__FE985_7'),
    body := '{}'::jsonb
  );
  $$
);

-- 2) Loyalty reminder — every day at 10:00 UTC
SELECT cron.schedule(
  'run-loyalty-reminder-daily',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--4d4aad01-9bf4-4d8b-acab-e51a06a17c63.lovable.app/api/public/hooks/run-loyalty-reminder',
    headers := jsonb_build_object('Content-Type','application/json','apikey','sb_publishable_t5XgSgu8VR1zrm4DTF5_lQ__FE985_7'),
    body := '{}'::jsonb
  );
  $$
);

-- 3) Restock alerts — every 4 hours
SELECT cron.schedule(
  'run-restock-alerts-4h',
  '0 */4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--4d4aad01-9bf4-4d8b-acab-e51a06a17c63.lovable.app/api/public/hooks/run-restock-alerts',
    headers := jsonb_build_object('Content-Type','application/json','apikey','sb_publishable_t5XgSgu8VR1zrm4DTF5_lQ__FE985_7'),
    body := '{}'::jsonb
  );
  $$
);
