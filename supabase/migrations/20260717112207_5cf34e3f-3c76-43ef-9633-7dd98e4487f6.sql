
DO $$
DECLARE
  v_secret text;
  v_job_id int;
BEGIN
  -- reuse the same cron secret as sun-tick
  SELECT value INTO v_secret FROM public.app_settings WHERE key = 'cron_secret' LIMIT 1;
  IF v_secret IS NULL THEN
    RAISE NOTICE 'cron_secret not set; skipping world-health schedule';
    RETURN;
  END IF;

  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'ai-world-health';
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'ai-world-health',
    '*/5 * * * *',
    format(
      $sql$SELECT net.http_post(
        url:='https://ympharma.lovable.app/api/public/ai/world-health',
        headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',%L),
        body:='{}'::jsonb
      );$sql$,
      v_secret
    )
  );
END $$;
