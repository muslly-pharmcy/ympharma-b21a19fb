
CREATE OR REPLACE FUNCTION public.schedule_event_consumer(
  _cron_secret  TEXT,
  _project_host TEXT DEFAULT 'project--4d4aad01-9bf4-4d8b-acab-e51a06a17c63.lovable.app',
  _schedule     TEXT DEFAULT '* * * * *',
  _batch        INT  DEFAULT 25
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, net
AS $$
DECLARE
  job_id   BIGINT;
  job_name TEXT := 'event-consumer-tick';
  url      TEXT;
  headers  JSONB;
  body     JSONB;
  cmd      TEXT;
BEGIN
  IF _cron_secret IS NULL OR length(_cron_secret) < 8 THEN
    RAISE EXCEPTION 'cron_secret missing or too short';
  END IF;

  -- Remove any prior schedule with this name (idempotent reinstall)
  PERFORM cron.unschedule(jobid)
    FROM cron.job
   WHERE jobname = job_name;

  url     := format('https://%s/api/public/hooks/event-consumer', _project_host);
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-cron-secret', _cron_secret);
  body    := jsonb_build_object('batch', _batch);

  -- Build the inline command; literals are escaped via quote_literal.
  cmd := format(
    $cmd$SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb) AS request_id;$cmd$,
    url, headers::text, body::text
  );

  job_id := cron.schedule(job_name, _schedule, cmd);

  RETURN jsonb_build_object(
    'ok', true,
    'job_id', job_id,
    'job_name', job_name,
    'schedule', _schedule,
    'url', url,
    'batch', _batch);
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_event_consumer(text,text,text,int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_event_consumer(text,text,text,int) TO service_role;

-- Companion: read current schedule (admin dashboards)
CREATE OR REPLACE FUNCTION public.get_event_consumer_schedule()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE r RECORD;
BEGIN
  SELECT jobid, jobname, schedule, active, last_start_time IS NOT NULL AS has_run
    INTO r
    FROM cron.job
    LEFT JOIN LATERAL (
      SELECT MAX(start_time) AS last_start_time
        FROM cron.job_run_details d
       WHERE d.jobid = cron.job.jobid
    ) lrd ON TRUE
   WHERE jobname = 'event-consumer-tick';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('installed', false);
  END IF;
  RETURN jsonb_build_object(
    'installed', true,
    'job_id', r.jobid,
    'schedule', r.schedule,
    'active', r.active);
END;
$$;

REVOKE ALL ON FUNCTION public.get_event_consumer_schedule() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_consumer_schedule() TO authenticated, service_role;
