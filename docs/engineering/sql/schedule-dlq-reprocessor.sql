-- ADR-0001 · Schedule the DLQ reprocessor.
--
-- REQUIRES ELEVATED PRIVILEGES: the executing role needs USAGE on the
-- `cron` schema (Supabase project owner). Apply from the SQL editor
-- while impersonating the postgres role, or wrap in a migration that
-- runs under an elevated deploy identity.
--
-- Contract: mirrors `public.schedule_event_consumer`. Runs the DLQ
-- reprocessor every 15 minutes, batch size 50, authenticated via
-- `x-cron-secret`.
--
-- Idempotent: unschedules any prior job with the same name before
-- re-installing.

CREATE OR REPLACE FUNCTION public.schedule_dlq_reprocessor(
  _cron_secret text,
  _project_host text DEFAULT 'project--4d4aad01-9bf4-4d8b-acab-e51a06a17c63.lovable.app',
  _schedule text DEFAULT '*/15 * * * *',
  _batch integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'cron', 'net'
AS $function$
DECLARE
  job_id   BIGINT;
  job_name TEXT := 'dlq-reprocessor-tick';
  url      TEXT;
  headers  JSONB;
  body     JSONB;
  cmd      TEXT;
BEGIN
  IF _cron_secret IS NULL OR length(_cron_secret) < 8 THEN
    RAISE EXCEPTION 'cron_secret missing or too short';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('schedule_dlq_reprocessor:' || job_name, 0));
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = job_name;

  url     := format('https://%s/api/public/hooks/dlq-reprocessor', _project_host);
  headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'x-cron-secret', _cron_secret);
  body    := jsonb_build_object('batch', _batch);

  cmd := format(
    $cmd$SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb) AS request_id;$cmd$,
    url, headers::text, body::text
  );

  job_id := cron.schedule(job_name, _schedule, cmd);

  RETURN jsonb_build_object('installed', true, 'job_id', job_id, 'schedule', _schedule);
END;
$function$;

REVOKE ALL ON FUNCTION public.schedule_dlq_reprocessor(text, text, text, integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_dlq_reprocessor_schedule()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'cron'
AS $function$
DECLARE r RECORD;
BEGIN
  SELECT jobid, jobname, schedule, active
    INTO r
    FROM cron.job
   WHERE jobname = 'dlq-reprocessor-tick';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('installed', false);
  END IF;
  RETURN jsonb_build_object(
    'installed', true, 'job_id', r.jobid,
    'schedule', r.schedule, 'active', r.active);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_dlq_reprocessor_schedule() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dlq_reprocessor_schedule() TO authenticated;

-- Install: run once with the shared cron secret in a privileged session.
-- SELECT public.schedule_dlq_reprocessor('<CRON_SECRET>');
