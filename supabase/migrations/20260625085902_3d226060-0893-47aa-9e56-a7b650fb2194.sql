
-- 1) Add backoff/error tracking to social_posts
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text;

-- 2) Update run_cto_worker: compute uptime from health_checks first; fallback to uptime_checks
CREATE OR REPLACE FUNCTION public.run_cto_worker()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_err_24 int := 0; v_err_critical int := 0;
  v_uptime_pct numeric; v_open_inc int := 0;
  v_uptime_score numeric; v_health_score numeric;
  v_recs int := 0; v_cluster RECORD;
  v_hc_total int; v_hc_pass int;
  v_last_pass timestamptz; v_last_fail timestamptz;
  v_source text;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE level IN ('error','fatal'))
    INTO v_err_24, v_err_critical FROM public.error_logs
    WHERE occurred_at >= now() - interval '24 hours';

  -- Prefer health_checks (last 24h, status='healthy' counts as pass)
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE status = 'healthy'),
         MAX(created_at) FILTER (WHERE status = 'healthy'),
         MAX(created_at) FILTER (WHERE status <> 'healthy')
    INTO v_hc_total, v_hc_pass, v_last_pass, v_last_fail
    FROM public.health_checks
    WHERE created_at >= now() - interval '24 hours';

  IF v_hc_total > 0 THEN
    v_uptime_pct := v_hc_pass::numeric / v_hc_total * 100;
    v_source := 'health_checks';
  ELSE
    -- Fallback to uptime_checks
    SELECT CASE WHEN COUNT(*)>0 THEN (COUNT(*) FILTER (WHERE ok))::numeric/COUNT(*)*100 ELSE NULL END
      INTO v_uptime_pct FROM public.uptime_checks
      WHERE checked_at >= now() - interval '24 hours';
    SELECT MAX(checked_at) FILTER (WHERE ok), MAX(checked_at) FILTER (WHERE NOT ok)
      INTO v_last_pass, v_last_fail FROM public.uptime_checks
      WHERE checked_at >= now() - interval '24 hours';
    v_source := 'uptime_checks';
  END IF;

  SELECT COUNT(*) INTO v_open_inc FROM public.system_incidents WHERE status='open';

  FOR v_cluster IN
    SELECT source, left(message,80) AS msg, COUNT(*) AS c
    FROM public.error_logs WHERE occurred_at >= now() - interval '24 hours'
      AND level IN ('error','fatal','warn')
    GROUP BY source, left(message,80) HAVING COUNT(*) >= 2
    ORDER BY COUNT(*) DESC LIMIT 10
  LOOP
    INSERT INTO public.system_incidents(source, severity, title, summary, evidence, dedupe_key)
    VALUES ('runtime',
      CASE WHEN v_cluster.c>=20 THEN 'critical' WHEN v_cluster.c>=10 THEN 'high' ELSE 'warn' END,
      format('تكرار خطأ: %s', COALESCE(v_cluster.msg,'(فارغ)')),
      format('%s حدوث خلال 24 ساعة من %s', v_cluster.c, COALESCE(v_cluster.source,'-')),
      jsonb_build_object('count',v_cluster.c,'source',v_cluster.source,'sample',v_cluster.msg),
      'err_'||md5(COALESCE(v_cluster.source,'')||COALESCE(v_cluster.msg,'')))
    ON CONFLICT (dedupe_key) DO UPDATE
      SET evidence = EXCLUDED.evidence, severity = EXCLUDED.severity;

    PERFORM public._agent_rec_upsert('cto','infra',
      format('عنقود خطأ: %s', LEFT(COALESCE(v_cluster.msg,'-'),60)),
      format('%s تكرار من %s — تحقيق فوري', v_cluster.c, COALESCE(v_cluster.source,'-')),
      jsonb_build_object('count',v_cluster.c,'source',v_cluster.source),
      v_cluster.c*100, 85,
      'cto_err_'||md5(COALESCE(v_cluster.source,'')||COALESCE(v_cluster.msg,''))||'_'||to_char(CURRENT_DATE,'IYYY-IW'));
    v_recs := v_recs + 1;
  END LOOP;

  PERFORM public._agent_rec_upsert('cto','infra',
    format('تقرير صحة النظام: %s%% uptime / %s خطأ', COALESCE(round(v_uptime_pct)::text,'—'), v_err_24),
    format('حوادث مفتوحة %s، أخطاء حرجة %s — مصدر: %s', v_open_inc, v_err_critical, v_source),
    jsonb_build_object('uptime_pct',v_uptime_pct,'errors_24h',v_err_24,'critical',v_err_critical,
      'open_incidents',v_open_inc,'source',v_source,'last_success_at',v_last_pass,'last_failure_at',v_last_fail),
    0, 60, 'cto_health_'||to_char(CURRENT_DATE,'IYYY-IW'));
  v_recs := v_recs + 1;

  v_uptime_score := COALESCE(v_uptime_pct, 100);
  v_health_score := GREATEST(0, 100 - LEAST(100, v_err_critical*2 + v_err_24*0.1));
  PERFORM public._agent_kpi_upsert('cto','uptime_score', v_uptime_score,
    jsonb_build_object('uptime_pct_24h',v_uptime_pct,'source',v_source,
      'last_success_at',v_last_pass,'last_failure_at',v_last_fail));
  PERFORM public._agent_kpi_upsert('cto','system_health_score', v_health_score,
    jsonb_build_object('errors_24h',v_err_24,'critical_24h',v_err_critical,'open_incidents',v_open_inc));

  RETURN jsonb_build_object('findings_count', v_err_24,'recommendations_count', v_recs,
    'summary', format('أخطاء 24س: %s / توفّر %s%% / حوادث %s (مصدر: %s)',
      v_err_24, COALESCE(round(v_uptime_pct)::text,'—'), v_open_inc, v_source),
    'details', jsonb_build_object('errors_24h',v_err_24,'uptime_pct',v_uptime_pct,
      'source',v_source,'last_success_at',v_last_pass,'last_failure_at',v_last_fail));
END $function$;

-- 3) Allow service_role to insert health_checks (cron writer)
GRANT INSERT, SELECT ON public.health_checks TO service_role;

-- 4) get_agent_alerts(): returns active alert conditions from latest agent_runs/kpis
CREATE OR REPLACE FUNCTION public.get_agent_alerts()
RETURNS TABLE(alert_key text, agent text, severity text, message text, payload jsonb)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uptime numeric; v_overdue int; v_growth numeric; v_errors int;
BEGIN
  -- Uptime from latest cto run details
  SELECT (details->>'uptime_pct')::numeric, (details->>'errors_24h')::int
    INTO v_uptime, v_errors
    FROM public.agent_runs WHERE agent='cto' ORDER BY created_at DESC LIMIT 1;

  IF v_uptime IS NOT NULL AND v_uptime < 50 THEN
    alert_key := 'cto_uptime_low_'||to_char(CURRENT_DATE,'YYYY-MM-DD');
    agent := 'cto'; severity := CASE WHEN v_uptime = 0 THEN 'critical' ELSE 'high' END;
    message := format('Uptime منخفض: %s%% خلال آخر 24 ساعة', round(v_uptime));
    payload := jsonb_build_object('uptime_pct', v_uptime, 'errors_24h', v_errors);
    RETURN NEXT;
  END IF;

  IF v_errors IS NOT NULL AND v_errors >= 50 THEN
    alert_key := 'cto_errors_high_'||to_char(CURRENT_DATE,'YYYY-MM-DD');
    agent := 'cto'; severity := 'high';
    message := format('عدد أخطاء مرتفع: %s خطأ خلال 24 ساعة', v_errors);
    payload := jsonb_build_object('errors_24h', v_errors);
    RETURN NEXT;
  END IF;

  -- Operations overdue
  SELECT (details->>'overdue')::int INTO v_overdue
    FROM public.agent_runs WHERE agent='operations' ORDER BY created_at DESC LIMIT 1;
  IF v_overdue IS NOT NULL AND v_overdue >= 5 THEN
    alert_key := 'ops_overdue_'||to_char(CURRENT_DATE,'YYYY-MM-DD');
    agent := 'operations'; severity := CASE WHEN v_overdue >= 20 THEN 'high' ELSE 'medium' END;
    message := format('%s طلب متأخر بدون معالجة', v_overdue);
    payload := jsonb_build_object('overdue', v_overdue);
    RETURN NEXT;
  END IF;

  -- CEO negative growth
  SELECT (details->>'growth_pct')::numeric INTO v_growth
    FROM public.agent_runs WHERE agent='ceo' ORDER BY created_at DESC LIMIT 1;
  IF v_growth IS NOT NULL AND v_growth <= -25 THEN
    alert_key := 'ceo_growth_neg_'||to_char(CURRENT_DATE,'IYYY-IW');
    agent := 'ceo'; severity := 'high';
    message := format('نمو سلبي حاد: %s%% أسبوعياً', round(v_growth));
    payload := jsonb_build_object('growth_pct', v_growth);
    RETURN NEXT;
  END IF;
END $function$;

GRANT EXECUTE ON FUNCTION public.get_agent_alerts() TO authenticated, service_role;
