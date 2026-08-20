
CREATE TABLE IF NOT EXISTS public.retention_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  error_logs_days int NOT NULL DEFAULT 30,
  error_logs_archive_days int NOT NULL DEFAULT 180,
  incidents_days int NOT NULL DEFAULT 90,
  incidents_archive_days int NOT NULL DEFAULT 365,
  uptime_checks_days int NOT NULL DEFAULT 30,
  archive_enabled boolean NOT NULL DEFAULT true,
  email_alerts_enabled boolean NOT NULL DEFAULT false,
  email_recipients text[] NOT NULL DEFAULT ARRAY[]::text[],
  email_cooldown_minutes int NOT NULL DEFAULT 60,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.retention_config TO authenticated;
GRANT ALL ON public.retention_config TO service_role;

ALTER TABLE public.retention_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read retention" ON public.retention_config;
CREATE POLICY "admins read retention" ON public.retention_config FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins write retention" ON public.retention_config;
CREATE POLICY "admins write retention" ON public.retention_config FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

INSERT INTO public.retention_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Replace run_retention_policy to honor configured durations + archive toggle.
CREATE OR REPLACE FUNCTION public.run_retention_policy()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cfg public.retention_config;
  v_err_archived int := 0;
  v_err_purged int := 0;
  v_inc_archived int := 0;
  v_inc_purged int := 0;
  v_checks_purged int := 0;
BEGIN
  SELECT * INTO v_cfg FROM public.retention_config WHERE id = 1;
  IF v_cfg IS NULL THEN
    INSERT INTO public.retention_config(id) VALUES (1) RETURNING * INTO v_cfg;
  END IF;

  IF v_cfg.archive_enabled THEN
    WITH moved AS (
      DELETE FROM public.error_logs
      WHERE occurred_at < now() - make_interval(days => v_cfg.error_logs_days)
      RETURNING *
    ), ins AS (
      INSERT INTO public.error_logs_archive
      SELECT *, now() FROM moved
      RETURNING 1
    )
    SELECT count(*) INTO v_err_archived FROM ins;

    DELETE FROM public.error_logs_archive
    WHERE archived_at < now() - make_interval(days => v_cfg.error_logs_archive_days);
    GET DIAGNOSTICS v_err_purged = ROW_COUNT;

    WITH moved AS (
      DELETE FROM public.uptime_incidents
      WHERE ended_at IS NOT NULL AND ended_at < now() - make_interval(days => v_cfg.incidents_days)
      RETURNING *
    ), ins AS (
      INSERT INTO public.uptime_incidents_archive
      SELECT *, now() FROM moved
      RETURNING 1
    )
    SELECT count(*) INTO v_inc_archived FROM ins;

    DELETE FROM public.uptime_incidents_archive
    WHERE archived_at < now() - make_interval(days => v_cfg.incidents_archive_days);
    GET DIAGNOSTICS v_inc_purged = ROW_COUNT;
  ELSE
    DELETE FROM public.error_logs
    WHERE occurred_at < now() - make_interval(days => v_cfg.error_logs_days);
    GET DIAGNOSTICS v_err_purged = ROW_COUNT;

    DELETE FROM public.uptime_incidents
    WHERE ended_at IS NOT NULL AND ended_at < now() - make_interval(days => v_cfg.incidents_days);
    GET DIAGNOSTICS v_inc_purged = ROW_COUNT;
  END IF;

  DELETE FROM public.uptime_checks
  WHERE checked_at < now() - make_interval(days => v_cfg.uptime_checks_days);
  GET DIAGNOSTICS v_checks_purged = ROW_COUNT;

  RETURN jsonb_build_object(
    'error_logs_archived', v_err_archived,
    'error_logs_purged_or_archive_purged', v_err_purged,
    'incidents_archived', v_inc_archived,
    'incidents_purged_or_archive_purged', v_inc_purged,
    'uptime_checks_purged', v_checks_purged,
    'archive_mode', v_cfg.archive_enabled,
    'ran_at', now()
  );
END; $function$;
