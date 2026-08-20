SELECT cron.schedule(
  'retry-failed-social-posts',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--4d4aad01-9bf4-4d8b-acab-e51a06a17c63.lovable.app/api/public/hooks/retry-failed-posts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
