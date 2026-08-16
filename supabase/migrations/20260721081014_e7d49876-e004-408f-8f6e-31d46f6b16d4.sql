-- 1) Rotate cron job for social posts to use CRON_SECRET header instead of anon apikey.
DO $$
DECLARE v_url text; v_secret text; jid int;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1;
  v_url := 'https://project--4d4aad01-9bf4-4d8b-acab-e51a06a17c63.lovable.app/api/public/hooks/generate-social-posts';
  FOR jid IN SELECT jobid FROM cron.job WHERE command ILIKE '%generate-social-posts%' LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
  IF v_secret IS NOT NULL THEN
    PERFORM cron.schedule(
      'generate-social-posts-daily',
      '0 8 * * *',
      format($cmd$
        select net.http_post(
          url:=%L,
          headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',%L),
          body:='{}'::jsonb
        );
      $cmd$, v_url, v_secret)
    );
  END IF;
END $$;

-- 2) Restrict air_agents / air_prompts SELECT to admins only.
-- Runtime code reads these via supabaseAdmin (service_role bypasses RLS), so
-- limiting authenticated reads to admins does not break the app.
DROP POLICY IF EXISTS air_agents_read ON public.air_agents;
CREATE POLICY air_agents_admin_read ON public.air_agents
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS air_prompts_read ON public.air_prompts;
CREATE POLICY air_prompts_admin_read ON public.air_prompts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
