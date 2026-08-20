-- Schedule nightly provider ranking refresh (03:15 UTC)
DO $$
DECLARE
  anon_key text := 'sb_publishable_t5XgSgu8VR1zrm4DTF5_lQ__FE985_7';
BEGIN
  PERFORM cron.unschedule('ranking-tick-nightly') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='ranking-tick-nightly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'ranking-tick-nightly',
  '15 3 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ympharma.lovable.app/api/public/ai/ranking-tick',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey','sb_publishable_t5XgSgu8VR1zrm4DTF5_lQ__FE985_7'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
