
-- ============ Replace partial unique indexes with regular ones ============
DROP INDEX IF EXISTS public.agent_recommendations_dedupe;
ALTER TABLE public.agent_recommendations
  ALTER COLUMN dedupe_key SET DEFAULT '';
UPDATE public.agent_recommendations SET dedupe_key = COALESCE(dedupe_key, gen_random_uuid()::text) WHERE dedupe_key IS NULL;
ALTER TABLE public.agent_recommendations ALTER COLUMN dedupe_key SET NOT NULL;
ALTER TABLE public.agent_recommendations
  ADD CONSTRAINT agent_recommendations_dedupe UNIQUE (agent_name, dedupe_key);

DROP INDEX IF EXISTS public.operations_alerts_dedupe;
UPDATE public.operations_alerts SET dedupe_key = COALESCE(dedupe_key, gen_random_uuid()::text) WHERE dedupe_key IS NULL;
ALTER TABLE public.operations_alerts ALTER COLUMN dedupe_key SET DEFAULT '';
ALTER TABLE public.operations_alerts ALTER COLUMN dedupe_key SET NOT NULL;
ALTER TABLE public.operations_alerts
  ADD CONSTRAINT operations_alerts_dedupe UNIQUE (dedupe_key);

DROP INDEX IF EXISTS public.system_incidents_dedupe;
UPDATE public.system_incidents SET dedupe_key = COALESCE(dedupe_key, gen_random_uuid()::text) WHERE dedupe_key IS NULL;
ALTER TABLE public.system_incidents ALTER COLUMN dedupe_key SET DEFAULT '';
ALTER TABLE public.system_incidents ALTER COLUMN dedupe_key SET NOT NULL;
ALTER TABLE public.system_incidents
  ADD CONSTRAINT system_incidents_dedupe UNIQUE (dedupe_key);

-- CTO worker: same ON CONFLICT fix
CREATE OR REPLACE FUNCTION public.run_cto_worker()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_err_24 int; v_err_critical int; v_uptime_pct numeric; v_open_inc int;
  v_uptime_score numeric; v_health_score numeric; v_recs int := 0;
  v_cluster RECORD;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE level IN ('error','fatal'))
    INTO v_err_24, v_err_critical FROM public.error_logs
    WHERE occurred_at >= now() - interval '24 hours';
  SELECT CASE WHEN COUNT(*)>0 THEN (COUNT(*) FILTER (WHERE ok))::numeric/COUNT(*)*100 ELSE NULL END
    INTO v_uptime_pct FROM public.uptime_checks
    WHERE checked_at >= now() - interval '24 hours';
  SELECT COUNT(*) INTO v_open_inc FROM public.system_incidents WHERE status='open';
  FOR v_cluster IN
    SELECT source, left(message,80) AS msg, COUNT(*) AS c
    FROM public.error_logs WHERE occurred_at >= now() - interval '6 hours'
      AND level IN ('error','fatal')
    GROUP BY source, left(message,80) HAVING COUNT(*) >= 5
    ORDER BY COUNT(*) DESC LIMIT 5
  LOOP
    INSERT INTO public.system_incidents(source, severity, title, summary, evidence, dedupe_key)
    VALUES ('runtime',
      CASE WHEN v_cluster.c>=20 THEN 'critical' WHEN v_cluster.c>=10 THEN 'high' ELSE 'warn' END,
      format('تكرار خطأ: %s', COALESCE(v_cluster.msg,'(فارغ)')),
      format('%s حدوث خلال 6 ساعات من المصدر %s', v_cluster.c, COALESCE(v_cluster.source,'-')),
      jsonb_build_object('count',v_cluster.c,'source',v_cluster.source,'sample',v_cluster.msg),
      'err_'||md5(COALESCE(v_cluster.source,'')||COALESCE(v_cluster.msg,'')))
    ON CONFLICT (dedupe_key) DO UPDATE
      SET evidence = EXCLUDED.evidence, severity = EXCLUDED.severity;
    v_recs := v_recs + 1;
  END LOOP;
  v_uptime_score := COALESCE(v_uptime_pct, 100);
  v_health_score := GREATEST(0, 100 - LEAST(100, v_err_critical*2 + v_err_24*0.1));
  PERFORM public._agent_kpi_upsert('cto','uptime_score', v_uptime_score,
    jsonb_build_object('uptime_pct_24h',v_uptime_pct));
  PERFORM public._agent_kpi_upsert('cto','system_health_score', v_health_score,
    jsonb_build_object('errors_24h',v_err_24,'critical_24h',v_err_critical,'open_incidents',v_open_inc));
  RETURN jsonb_build_object('findings_count', v_err_24,'recommendations_count', v_recs,
    'summary', format('أخطاء 24س: %s (حرجة %s) / توفّر %s%% / حوادث مفتوحة %s',
      v_err_24, v_err_critical, COALESCE(round(v_uptime_pct)::text,'—'), v_open_inc),
    'details', jsonb_build_object('errors_24h',v_err_24,'critical',v_err_critical,
      'uptime_pct',v_uptime_pct,'open_incidents',v_open_inc));
END $$;

-- Operations worker: ON CONFLICT (dedupe_key)
CREATE OR REPLACE FUNCTION public.run_operations_worker()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_recs int := 0; v_pending_old int; v_proc_old int; v_o RECORD;
        v_total_24 int; v_done_24 int; v_sla numeric; v_fulfill numeric;
BEGIN
  SELECT COUNT(*) INTO v_pending_old FROM public.orders
    WHERE status='pending' AND created_at < now() - interval '2 hours';
  SELECT COUNT(*) INTO v_proc_old FROM public.orders
    WHERE status='processing' AND created_at < now() - interval '24 hours';
  FOR v_o IN
    SELECT id, customer_name, customer_phone, status, created_at,
      EXTRACT(EPOCH FROM (now()-created_at))/3600 AS hrs
    FROM public.orders
    WHERE (status='pending' AND created_at < now() - interval '2 hours')
       OR (status='processing' AND created_at < now() - interval '24 hours')
    ORDER BY created_at LIMIT 30
  LOOP
    INSERT INTO public.operations_alerts(kind, ref_id, summary, severity, dedupe_key)
    VALUES (
      CASE WHEN v_o.status='pending' THEN 'sla_breach' ELSE 'order_delay' END,
      v_o.id,
      format('طلب %s متأخر %s ساعة — حالة %s — %s', v_o.id, round(v_o.hrs), v_o.status, v_o.customer_name),
      CASE WHEN v_o.hrs>48 THEN 'critical' WHEN v_o.hrs>12 THEN 'high' ELSE 'warn' END,
      'ops_'||v_o.id||'_'||v_o.status)
    ON CONFLICT (dedupe_key) DO UPDATE SET summary = EXCLUDED.summary, severity = EXCLUDED.severity;
    v_recs := v_recs + 1;
  END LOOP;
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status IN ('completed','delivered','shipped'))
    INTO v_total_24, v_done_24 FROM public.orders WHERE created_at >= now()-interval '7 days';
  v_sla := CASE WHEN v_total_24>0 THEN GREATEST(0, 100 - (v_pending_old+v_proc_old)::numeric/v_total_24*100) ELSE 100 END;
  v_fulfill := CASE WHEN v_total_24>0 THEN v_done_24::numeric/v_total_24*100 ELSE 0 END;
  PERFORM public._agent_kpi_upsert('operations','sla_score', v_sla,
    jsonb_build_object('pending_overdue',v_pending_old,'processing_overdue',v_proc_old));
  PERFORM public._agent_kpi_upsert('operations','fulfillment_score', v_fulfill,
    jsonb_build_object('orders_7d',v_total_24,'completed',v_done_24));
  RETURN jsonb_build_object('findings_count', v_pending_old+v_proc_old, 'recommendations_count', v_recs,
    'summary', format('%s طلب متأخر (معلق %s، قيد المعالجة %s)', v_pending_old+v_proc_old, v_pending_old, v_proc_old),
    'details', jsonb_build_object('pending_old',v_pending_old,'processing_old',v_proc_old));
END $$;

-- Marketing worker: guard chronic_flags shape (jsonb may not always be array)
CREATE OR REPLACE FUNCTION public.run_marketing_worker()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_recs int := 0; v_dormant int; v_chronic int; v_engaged int; v_total int;
        v_engagement numeric; v_readiness numeric;
BEGIN
  SELECT COUNT(*) INTO v_dormant FROM public.customer_profiles
    WHERE last_order_at < now() - interval '60 days' AND orders_count >= 2;
  SELECT COUNT(*) INTO v_chronic FROM public.customer_profiles
    WHERE chronic_flags IS NOT NULL
      AND jsonb_typeof(chronic_flags) = 'array'
      AND jsonb_array_length(chronic_flags) > 0;
  SELECT COUNT(*) INTO v_engaged FROM public.customer_profiles
    WHERE last_order_at >= now() - interval '30 days';
  SELECT COUNT(*) INTO v_total FROM public.customer_profiles;

  IF v_dormant > 0 THEN
    PERFORM public._agent_rec_upsert('marketing','marketing',
      format('حملة إيقاظ: %s عميل خامل', v_dormant),
      'عملاء بدون طلب منذ 60+ يوم — أرسل قسيمة 10% لتنشيطهم',
      jsonb_build_object('count',v_dormant,'segment','dormant','discount_pct',10),
      v_dormant * 800, 80,
      'mkt_dormant_'||to_char(CURRENT_DATE,'IYYY-IW'));
    v_recs := v_recs + 1;
  END IF;
  IF v_chronic > 0 THEN
    PERFORM public._agent_rec_upsert('marketing','marketing',
      format('تذكير مزمن: %s مريض', v_chronic),
      'مرضى مزمنون يحتاجون إعادة صرف — استخدم الزر "إرسال تذكيرات المزمن"',
      jsonb_build_object('count',v_chronic,'segment','chronic','discount_pct',15),
      v_chronic * 1200, 90,
      'mkt_chronic_'||to_char(CURRENT_DATE,'IYYY-IW'));
    v_recs := v_recs + 1;
  END IF;

  v_engagement := CASE WHEN v_total>0 THEN v_engaged::numeric/v_total*100 ELSE 0 END;
  v_readiness := LEAST(100, v_recs*40 + LEAST(20, v_chronic*0.5));

  PERFORM public._agent_kpi_upsert('marketing','engagement_score', v_engagement,
    jsonb_build_object('engaged_30d',v_engaged,'total',v_total,'dormant',v_dormant));
  PERFORM public._agent_kpi_upsert('marketing','campaign_readiness_score', v_readiness,
    jsonb_build_object('campaigns_ready',v_recs,'chronic',v_chronic));

  RETURN jsonb_build_object('findings_count', v_dormant + v_chronic, 'recommendations_count', v_recs,
    'summary', format('%s خامل / %s مزمن / %s نشط — %s حملة جاهزة', v_dormant, v_chronic, v_engaged, v_recs),
    'details', jsonb_build_object('dormant',v_dormant,'chronic',v_chronic,'engaged',v_engaged));
END $$;
