
DO $$ BEGIN
  PERFORM cron.unschedule('incident-alert-dispatch');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'incident-alert-dispatch',
  '*/5 * * * *',
  $$
  SELECT net.http_get(
    url := 'https://muslly.com/api/public/incident-check?apikey=' ||
           (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'incident_check_apikey' LIMIT 1)
  );
  $$
);

-- Store apikey in vault for use by cron (writes the SUPABASE publishable key)
DO $$
DECLARE
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'incident_check_apikey' LIMIT 1;
  IF v_key IS NULL THEN
    PERFORM vault.create_secret(
      'PLACEHOLDER_FILL_FROM_ADMIN_UI'::text,
      'incident_check_apikey',
      'apikey for /api/public/incident-check (set to project anon/publishable key)'
    );
  END IF;
END $$;
