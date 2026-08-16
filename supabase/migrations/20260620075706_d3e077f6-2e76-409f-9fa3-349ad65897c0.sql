
-- 1) Schedule operations log
CREATE TABLE IF NOT EXISTS public.event_consumer_schedule_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id  UUID NOT NULL,
  action          TEXT NOT NULL CHECK (action IN ('install','reinstall','uninstall')),
  actor_user_id   UUID,
  status          TEXT NOT NULL CHECK (status IN ('ok','error')),
  job_id          BIGINT,
  job_name        TEXT,
  schedule        TEXT,
  url             TEXT,
  batch           INT,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_consumer_schedule_log_created_idx
  ON public.event_consumer_schedule_log (created_at DESC);
CREATE INDEX IF NOT EXISTS event_consumer_schedule_log_corr_idx
  ON public.event_consumer_schedule_log (correlation_id);

GRANT SELECT ON public.event_consumer_schedule_log TO authenticated;
GRANT ALL    ON public.event_consumer_schedule_log TO service_role;

ALTER TABLE public.event_consumer_schedule_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schedule_log_admins_read"
  ON public.event_consumer_schedule_log;
CREATE POLICY "schedule_log_admins_read"
  ON public.event_consumer_schedule_log
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'owner'::app_role)
  );

-- 2) Idempotency-hardened schedule installer (advisory lock + unschedule by name)
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
  existed  BOOLEAN := FALSE;
BEGIN
  IF _cron_secret IS NULL OR length(_cron_secret) < 8 THEN
    RAISE EXCEPTION 'cron_secret missing or too short';
  END IF;

  -- Serialize concurrent installers — one transaction at a time.
  PERFORM pg_advisory_xact_lock(hashtextextended('schedule_event_consumer:' || job_name, 0));

  -- Drop every prior schedule sharing this name (idempotent reinstall).
  SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = job_name) INTO existed;
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = job_name;

  url     := format('https://%s/api/public/hooks/event-consumer', _project_host);
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-cron-secret', _cron_secret);
  body    := jsonb_build_object('batch', _batch);

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
    'batch', _batch,
    'reinstalled', existed);
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_event_consumer(text,text,text,int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_event_consumer(text,text,text,int) TO service_role;
