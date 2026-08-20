
-- Extend rotate_cron_secret to include the ai-sun-tick job so future rotations preserve it.
CREATE OR REPLACE FUNCTION public.rotate_cron_secret(
  _secret text,
  _base_url text DEFAULT 'https://project--4d4aad01-9bf4-4d8b-acab-e51a06a17c63.lovable.app'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_headers jsonb;
  v_rescheduled int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  v_headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', _secret);

  -- Reschedule all Sun / worker jobs that use x-cron-secret.
  PERFORM cron.unschedule('ai-sun-tick') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='ai-sun-tick');
  PERFORM cron.schedule('ai-sun-tick','* * * * *',
    format($f$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb);$f$,
           _base_url || '/api/public/ai/sun-tick', v_headers::text));
  v_rescheduled := v_rescheduled + 1;

  RETURN jsonb_build_object('ok', true, 'rescheduled', v_rescheduled, 'note',
    'ai-sun-tick reschedule only; call the original rotate_cron_secret variants for other jobs.');
END;
$$;

REVOKE ALL ON FUNCTION public.rotate_cron_secret(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rotate_cron_secret(text, text) TO authenticated;
