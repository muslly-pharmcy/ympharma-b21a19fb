
-- 1) Close discount-code leak via campaigns table.
DROP POLICY IF EXISTS "campaigns public read" ON public.campaigns;
-- Admin/owner/orders-permission policy already exists ("campaigns admin all").

-- 2) Owner-only helper that re-schedules every cron job that calls our
--    internal /api/public/hooks/* endpoints to use the new x-cron-secret header.
CREATE OR REPLACE FUNCTION public.rotate_cron_secret(_secret text, _base_url text DEFAULT 'https://project--4d4aad01-9bf4-4d8b-acab-e51a06a17c63.lovable.app')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_headers jsonb;
  v_rescheduled int := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _secret IS NULL OR length(_secret) < 16 THEN
    RAISE EXCEPTION 'cron secret too short';
  END IF;

  v_headers := jsonb_build_object(
    'Content-Type','application/json',
    'x-cron-secret', _secret
  );

  -- nightly customer intel rebuild — daily 23:30 UTC
  PERFORM cron.unschedule('muslly-nightly-intel');
  PERFORM cron.schedule('muslly-nightly-intel','30 23 * * *',
    format($f$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb);$f$,
           _base_url || '/api/public/hooks/nightly-intel', v_headers::text));
  v_rescheduled := v_rescheduled + 1;

  -- weekly AI customer enrichment — Sundays 03:00 UTC
  PERFORM cron.unschedule('weekly-ai-enrich');
  PERFORM cron.schedule('weekly-ai-enrich','0 3 * * 0',
    format($f$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{"limit":50}'::jsonb);$f$,
           _base_url || '/api/public/hooks/weekly-ai-enrich', v_headers::text));
  v_rescheduled := v_rescheduled + 1;

  -- weekly executive report — Sundays 03:30 UTC
  PERFORM cron.unschedule('weekly-exec-report');
  PERFORM cron.schedule('weekly-exec-report','30 3 * * 0',
    format($f$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb);$f$,
           _base_url || '/api/public/hooks/weekly-exec-report', v_headers::text));
  v_rescheduled := v_rescheduled + 1;

  -- staff alerts worker — every minute
  PERFORM cron.unschedule('staff-alerts-worker');
  PERFORM cron.schedule('staff-alerts-worker','* * * * *',
    format($f$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb);$f$,
           _base_url || '/api/public/hooks/alerts-worker', v_headers::text));
  v_rescheduled := v_rescheduled + 1;

  -- incident alert dispatch — every 5 minutes
  PERFORM cron.unschedule('incident-alert-dispatch');
  PERFORM cron.schedule('incident-alert-dispatch','*/5 * * * *',
    format($f$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb);$f$,
           _base_url || '/api/public/incident-check', v_headers::text));
  v_rescheduled := v_rescheduled + 1;

  RETURN jsonb_build_object('ok', true, 'rescheduled', v_rescheduled, 'rotated_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.rotate_cron_secret(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rotate_cron_secret(text, text) TO authenticated;
