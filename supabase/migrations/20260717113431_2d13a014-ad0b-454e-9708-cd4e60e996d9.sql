DO $$
BEGIN
  PERFORM cron.unschedule('ai-daily-business-report');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('security-daily-sweep');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'ai-daily-business-report',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--4d4aad01-9bf4-4d8b-acab-e51a06a17c63.lovable.app/api/public/ai/business-tick',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey','sb_publishable_t5XgSgu8VR1zrm4DTF5_lQ__FE985_7'
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'security-daily-sweep',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--4d4aad01-9bf4-4d8b-acab-e51a06a17c63.lovable.app/api/public/security/sweep',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey','sb_publishable_t5XgSgu8VR1zrm4DTF5_lQ__FE985_7'
    ),
    body := '{}'::jsonb
  );
  $$
);
