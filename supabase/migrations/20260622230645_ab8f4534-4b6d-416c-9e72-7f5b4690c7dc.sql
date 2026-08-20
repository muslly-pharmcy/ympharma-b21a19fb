
-- Admin-only RPC: list scheduled cron jobs
CREATE OR REPLACE FUNCTION public.admin_list_cron_jobs()
RETURNS TABLE (
  jobid bigint,
  jobname text,
  schedule text,
  command text,
  active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'owner'::public.app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
    SELECT j.jobid, j.jobname, j.schedule, j.command, j.active
    FROM cron.job j
    ORDER BY j.jobname;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_cron_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_cron_jobs() TO authenticated;

-- Admin-only RPC: recent cron run history
CREATE OR REPLACE FUNCTION public.admin_list_cron_runs(_limit int DEFAULT 100)
RETURNS TABLE (
  jobid bigint,
  runid bigint,
  job_pid integer,
  database text,
  username text,
  command text,
  status text,
  return_message text,
  start_time timestamptz,
  end_time timestamptz,
  jobname text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'owner'::public.app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
    SELECT d.jobid, d.runid, d.job_pid, d.database, d.username, d.command,
           d.status, d.return_message, d.start_time, d.end_time, j.jobname
    FROM cron.job_run_details d
    LEFT JOIN cron.job j ON j.jobid = d.jobid
    ORDER BY d.start_time DESC
    LIMIT GREATEST(1, LEAST(_limit, 500));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_cron_runs(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_cron_runs(int) TO authenticated;

-- Failure monitor: notify all admins when a job fails 2+ times in a row (last 6h window)
CREATE OR REPLACE FUNCTION public.monitor_cron_failures()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  v_job RECORD;
  v_admin RECORD;
  v_recent_status text;
  v_consecutive int;
  v_notified int := 0;
  v_already_alerted boolean;
BEGIN
  FOR v_job IN
    SELECT DISTINCT j.jobid, j.jobname
    FROM cron.job j
    WHERE j.jobname IN ('reactivation-campaign','loyalty-reminder-campaign','restock-alerts','cron-failure-monitor')
  LOOP
    -- count consecutive trailing failures in last 6h
    v_consecutive := 0;
    FOR v_recent_status IN
      SELECT status FROM cron.job_run_details
      WHERE jobid = v_job.jobid AND start_time > now() - interval '6 hours'
      ORDER BY start_time DESC
      LIMIT 10
    LOOP
      IF v_recent_status = 'failed' THEN
        v_consecutive := v_consecutive + 1;
      ELSE
        EXIT;
      END IF;
    END LOOP;

    IF v_consecutive >= 2 THEN
      -- de-dupe: skip if we already alerted in last 6h for this job
      SELECT EXISTS (
        SELECT 1 FROM public.notifications
        WHERE type = 'cron_failure'
          AND metadata->>'job' = v_job.jobname
          AND created_at > now() - interval '6 hours'
      ) INTO v_already_alerted;

      IF NOT v_already_alerted THEN
        FOR v_admin IN
          SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin','owner')
        LOOP
          INSERT INTO public.notifications(user_id, type, title, body, priority, metadata)
          VALUES (
            v_admin.user_id,
            'cron_failure',
            'فشل مهمة مجدولة: ' || v_job.jobname,
            'فشلت المهمة ' || v_consecutive || ' مرات متتالية خلال آخر 6 ساعات.',
            'high',
            jsonb_build_object('job', v_job.jobname, 'consecutive_failures', v_consecutive)
          );
          v_notified := v_notified + 1;
        END LOOP;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('notified', v_notified);
END;
$$;

REVOKE ALL ON FUNCTION public.monitor_cron_failures() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.monitor_cron_failures() TO service_role;
