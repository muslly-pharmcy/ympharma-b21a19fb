
CREATE OR REPLACE FUNCTION public.rotate_cron_secret(_secret text, _base_url text DEFAULT 'https://project--4d4aad01-9bf4-4d8b-acab-e51a06a17c63.lovable.app')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  v_headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', _secret);

  PERFORM cron.unschedule(jobname) FROM cron.job WHERE jobname IN
    ('muslly-nightly-intel','weekly-ai-enrich','weekly-exec-report','staff-alerts-worker','incident-alert-dispatch','muslly-chronic-refills');

  PERFORM cron.schedule('muslly-nightly-intel','30 23 * * *',
    format($f$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb);$f$,
           _base_url || '/api/public/hooks/nightly-intel', v_headers::text));
  v_rescheduled := v_rescheduled + 1;

  PERFORM cron.schedule('weekly-ai-enrich','0 3 * * 0',
    format($f$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{"limit":50}'::jsonb);$f$,
           _base_url || '/api/public/hooks/weekly-ai-enrich', v_headers::text));
  v_rescheduled := v_rescheduled + 1;

  PERFORM cron.schedule('weekly-exec-report','30 3 * * 0',
    format($f$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb);$f$,
           _base_url || '/api/public/hooks/weekly-exec-report', v_headers::text));
  v_rescheduled := v_rescheduled + 1;

  PERFORM cron.schedule('staff-alerts-worker','* * * * *',
    format($f$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb);$f$,
           _base_url || '/api/public/hooks/alerts-worker', v_headers::text));
  v_rescheduled := v_rescheduled + 1;

  PERFORM cron.schedule('incident-alert-dispatch','*/5 * * * *',
    format($f$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb);$f$,
           _base_url || '/api/public/incident-check', v_headers::text));
  v_rescheduled := v_rescheduled + 1;

  PERFORM cron.schedule('muslly-chronic-refills','0 9 * * 1',
    format($f$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{"discount_pct":15,"limit":50}'::jsonb);$f$,
           _base_url || '/api/public/hooks/chronic-refills', v_headers::text));
  v_rescheduled := v_rescheduled + 1;

  RETURN jsonb_build_object('ok', true, 'rescheduled', v_rescheduled, 'rotated_at', now());
END $$;
