
-- ============================================================================
-- PHASE 1: Fix marketing JSONB (bulletproof) + lower thresholds + baseline recs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.run_marketing_worker()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_recs int := 0; v_dormant int; v_chronic int; v_engaged int; v_total int;
        v_engagement numeric; v_readiness numeric;
BEGIN
  SELECT COUNT(*) INTO v_dormant FROM public.customer_profiles
    WHERE last_order_at < now() - interval '30 days' AND orders_count >= 1;

  -- bulletproof: only count when chronic_flags is a non-empty array
  SELECT COUNT(*) INTO v_chronic FROM public.customer_profiles
    WHERE jsonb_typeof(chronic_flags) = 'array'
      AND jsonb_array_length(
        CASE WHEN jsonb_typeof(chronic_flags)='array' THEN chronic_flags ELSE '[]'::jsonb END
      ) > 0;

  SELECT COUNT(*) INTO v_engaged FROM public.customer_profiles
    WHERE last_order_at >= now() - interval '30 days';
  SELECT COUNT(*) INTO v_total FROM public.customer_profiles;

  IF v_dormant > 0 THEN
    PERFORM public._agent_rec_upsert('marketing','marketing',
      format('حملة إيقاظ: %s عميل خامل', v_dormant),
      'عملاء بدون طلب منذ 30+ يوم — أرسل قسيمة 10%% لتنشيطهم',
      jsonb_build_object('count',v_dormant,'segment','dormant','discount_pct',10),
      v_dormant * 800, 80,
      'mkt_dormant_'||to_char(CURRENT_DATE,'IYYY-IW'));
    v_recs := v_recs + 1;
  END IF;
  IF v_chronic > 0 THEN
    PERFORM public._agent_rec_upsert('marketing','marketing',
      format('تذكير مزمن: %s مريض', v_chronic),
      'مرضى مزمنون يحتاجون إعادة صرف',
      jsonb_build_object('count',v_chronic,'segment','chronic','discount_pct',15),
      v_chronic * 1200, 90,
      'mkt_chronic_'||to_char(CURRENT_DATE,'IYYY-IW'));
    v_recs := v_recs + 1;
  END IF;

  -- baseline weekly digest so the agent always emits at least one rec
  PERFORM public._agent_rec_upsert('marketing','marketing',
    format('ملخص أسبوعي: %s عميل (%s نشط، %s خامل)', v_total, v_engaged, v_dormant),
    'مراجعة دورية لقاعدة العملاء وحالات التفاعل',
    jsonb_build_object('total',v_total,'engaged',v_engaged,'dormant',v_dormant),
    0, 60, 'mkt_digest_'||to_char(CURRENT_DATE,'IYYY-IW'));
  v_recs := v_recs + 1;

  v_engagement := CASE WHEN v_total>0 THEN v_engaged::numeric/v_total*100 ELSE 0 END;
  v_readiness := LEAST(100, v_recs*40 + LEAST(20, v_chronic*0.5));

  PERFORM public._agent_kpi_upsert('marketing','engagement_score', v_engagement,
    jsonb_build_object('engaged_30d',v_engaged,'total',v_total,'dormant',v_dormant));
  PERFORM public._agent_kpi_upsert('marketing','campaign_readiness_score', v_readiness,
    jsonb_build_object('campaigns_ready',v_recs,'chronic',v_chronic));

  RETURN jsonb_build_object('findings_count', v_dormant + v_chronic, 'recommendations_count', v_recs,
    'summary', format('%s خامل / %s مزمن / %s نشط — %s حملة جاهزة', v_dormant, v_chronic, v_engaged, v_recs),
    'details', jsonb_build_object('dormant',v_dormant,'chronic',v_chronic,'engaged',v_engaged));
END $fn$;

-- ============================================================================
-- LOWER THRESHOLDS + BASELINE RECS for all agents
-- ============================================================================

CREATE OR REPLACE FUNCTION public.run_ceo_worker()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_rev_7 numeric := 0; v_rev_prev numeric := 0; v_growth numeric;
        v_orders_7 int := 0; v_aov numeric := 0; v_margin numeric := 0; v_recs int := 0;
        v_growth_score numeric; v_profit_score numeric;
BEGIN
  SELECT COALESCE(SUM(total),0), COUNT(*) INTO v_rev_7, v_orders_7
    FROM public.orders WHERE created_at >= now() - interval '7 days' AND status <> 'cancelled';
  SELECT COALESCE(SUM(total),0) INTO v_rev_prev
    FROM public.orders WHERE created_at >= now() - interval '14 days'
      AND created_at < now() - interval '7 days' AND status <> 'cancelled';
  v_growth := CASE WHEN v_rev_prev > 0 THEN (v_rev_7 - v_rev_prev) / v_rev_prev * 100 ELSE NULL END;
  v_aov := CASE WHEN v_orders_7>0 THEN v_rev_7/v_orders_7 ELSE 0 END;

  WITH items AS (
    SELECT (it->>'id')::text AS pid, COALESCE((it->>'qty')::numeric,1) AS qty,
           COALESCE((it->>'price')::numeric,0) AS price
    FROM public.orders o, jsonb_array_elements(COALESCE(o.items,'[]'::jsonb)) it
    WHERE o.created_at >= now() - interval '7 days' AND o.status <> 'cancelled'
  ), joined AS (
    SELECT i.qty*i.price AS rev, i.qty*COALESCE(p.supplier_cost,i.price*0.7) AS cost
    FROM items i LEFT JOIN public.products p ON p.legacy_id::text = i.pid OR p.id::text = i.pid
  )
  SELECT CASE WHEN SUM(rev)>0 THEN (SUM(rev)-SUM(cost))/SUM(rev)*100 ELSE 0 END INTO v_margin FROM joined;

  v_growth_score := GREATEST(0, LEAST(100, COALESCE(50 + v_growth, 50)));
  v_profit_score := GREATEST(0, LEAST(100, v_margin*2));

  PERFORM public._agent_kpi_upsert('ceo','revenue_growth_score', v_growth_score,
    jsonb_build_object('rev_7d',v_rev_7,'rev_prev_7d',v_rev_prev,'growth_pct',v_growth,'orders_7d',v_orders_7,'aov',v_aov));
  PERFORM public._agent_kpi_upsert('ceo','profitability_score', v_profit_score,
    jsonb_build_object('gross_margin_pct',v_margin));

  -- always emit weekly executive recommendation
  PERFORM public._agent_rec_upsert('ceo','executive',
    format('تقرير تنفيذي أسبوعي: %s طلب / %s ر.ي', v_orders_7, round(v_rev_7)),
    format('متوسط الطلب %s ر.ي — هامش %s%% — نمو %s%%',
      round(v_aov), round(v_margin), COALESCE(round(v_growth)::text,'N/A')),
    jsonb_build_object('rev_7d',v_rev_7,'orders_7d',v_orders_7,'aov',v_aov,'margin_pct',v_margin,'growth_pct',v_growth),
    v_rev_7*0.05, 70, 'ceo_weekly_'||to_char(CURRENT_DATE,'IYYY-IW'));
  v_recs := v_recs + 1;

  IF v_growth IS NOT NULL AND v_growth < -5 THEN
    PERFORM public._agent_rec_upsert('ceo','executive','تراجع إيراد أسبوعي',
      format('انخفض الإيراد %s%% مقارنة بالأسبوع السابق', round(v_growth)),
      jsonb_build_object('rev_7d',v_rev_7,'rev_prev',v_rev_prev), v_rev_prev - v_rev_7, 80,
      'ceo_revdrop_'||to_char(CURRENT_DATE,'IYYY-IW'));
    v_recs := v_recs + 1;
  ELSIF v_growth IS NOT NULL AND v_growth > 5 THEN
    PERFORM public._agent_rec_upsert('ceo','executive','نمو إيراد قوي',
      format('نمو %s%% — وسّع الميزانية التسويقية', round(v_growth)),
      jsonb_build_object('rev_7d',v_rev_7), v_rev_7 - v_rev_prev, 75,
      'ceo_revup_'||to_char(CURRENT_DATE,'IYYY-IW'));
    v_recs := v_recs + 1;
  END IF;
  IF v_margin < 25 AND v_rev_7 > 0 THEN
    PERFORM public._agent_rec_upsert('ceo','executive','هامش ربح منخفض',
      format('الهامش الإجمالي %s%% — راجع تسعير المنتجات', round(v_margin)),
      jsonb_build_object('margin_pct',v_margin), v_rev_7*0.05, 65,
      'ceo_margin_'||to_char(CURRENT_DATE,'IYYY-IW'));
    v_recs := v_recs + 1;
  END IF;

  INSERT INTO public.executive_reports(day, payload)
    VALUES (CURRENT_DATE, jsonb_build_object('rev_7d',v_rev_7,'rev_prev_7d',v_rev_prev,
      'growth_pct',v_growth,'aov',v_aov,'margin_pct',v_margin,'orders_7d',v_orders_7,
      'generated_by','ceo_agent','generated_at',now()))
    ON CONFLICT (day) DO UPDATE SET payload = EXCLUDED.payload;

  RETURN jsonb_build_object('findings_count',3,'recommendations_count',v_recs,
    'summary',format('إيراد 7 أيام %s ر.ي / نمو %s%% / هامش %s%%',
      round(v_rev_7), COALESCE(round(v_growth)::text,'—'), round(v_margin)),
    'details',jsonb_build_object('rev_7d',v_rev_7,'growth_pct',v_growth,'margin_pct',v_margin));
END $fn$;

CREATE OR REPLACE FUNCTION public.run_cto_worker()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_err_24 int; v_err_critical int; v_uptime_pct numeric; v_open_inc int;
        v_uptime_score numeric; v_health_score numeric; v_recs int := 0; v_cluster RECORD;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE level IN ('error','fatal'))
    INTO v_err_24, v_err_critical FROM public.error_logs
    WHERE occurred_at >= now() - interval '24 hours';
  SELECT CASE WHEN COUNT(*)>0 THEN (COUNT(*) FILTER (WHERE ok))::numeric/COUNT(*)*100 ELSE NULL END
    INTO v_uptime_pct FROM public.uptime_checks
    WHERE checked_at >= now() - interval '24 hours';
  SELECT COUNT(*) INTO v_open_inc FROM public.system_incidents WHERE status='open';

  -- lowered threshold: 2+ in 24h
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

  -- baseline weekly health report
  PERFORM public._agent_rec_upsert('cto','infra',
    format('تقرير صحة النظام: %s%% uptime / %s خطأ', COALESCE(round(v_uptime_pct)::text,'—'), v_err_24),
    format('حوادث مفتوحة %s، أخطاء حرجة %s', v_open_inc, v_err_critical),
    jsonb_build_object('uptime_pct',v_uptime_pct,'errors_24h',v_err_24,'critical',v_err_critical,'open_incidents',v_open_inc),
    0, 60, 'cto_health_'||to_char(CURRENT_DATE,'IYYY-IW'));
  v_recs := v_recs + 1;

  v_uptime_score := COALESCE(v_uptime_pct, 100);
  v_health_score := GREATEST(0, 100 - LEAST(100, v_err_critical*2 + v_err_24*0.1));
  PERFORM public._agent_kpi_upsert('cto','uptime_score', v_uptime_score,
    jsonb_build_object('uptime_pct_24h',v_uptime_pct));
  PERFORM public._agent_kpi_upsert('cto','system_health_score', v_health_score,
    jsonb_build_object('errors_24h',v_err_24,'critical_24h',v_err_critical,'open_incidents',v_open_inc));
  RETURN jsonb_build_object('findings_count', v_err_24,'recommendations_count', v_recs,
    'summary', format('أخطاء 24س: %s / توفّر %s%% / حوادث %s',
      v_err_24, COALESCE(round(v_uptime_pct)::text,'—'), v_open_inc),
    'details', jsonb_build_object('errors_24h',v_err_24,'uptime_pct',v_uptime_pct));
END $fn$;

CREATE OR REPLACE FUNCTION public.run_sales_worker()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_recs int := 0; v_pair RECORD; v_total_orders int; v_top RECORD;
BEGIN
  SELECT COUNT(*) INTO v_total_orders FROM public.orders
    WHERE created_at >= now() - interval '90 days' AND status <> 'cancelled';

  -- co-purchase pairs (lowered to 2+)
  FOR v_pair IN
    WITH items AS (
      SELECT o.id AS oid, (it->>'name') AS name
      FROM public.orders o, jsonb_array_elements(COALESCE(o.items,'[]'::jsonb)) it
      WHERE o.created_at >= now() - interval '90 days' AND o.status <> 'cancelled'
    ), pairs AS (
      SELECT a.name AS a, b.name AS b, COUNT(DISTINCT a.oid)::int AS c
      FROM items a JOIN items b ON a.oid = b.oid AND a.name < b.name
      WHERE a.name IS NOT NULL AND b.name IS NOT NULL
      GROUP BY a.name, b.name HAVING COUNT(DISTINCT a.oid) >= 2
    )
    SELECT * FROM pairs ORDER BY c DESC LIMIT 10
  LOOP
    PERFORM public._agent_rec_upsert('sales','sales',
      format('عرض مشترك: %s + %s', v_pair.a, v_pair.b),
      format('شراء مشترك %s مرة — اقترح كحزمة', v_pair.c),
      jsonb_build_object('item_a',v_pair.a,'item_b',v_pair.b,'co_count',v_pair.c),
      (v_pair.c * 500)::numeric, LEAST(95, 40 + v_pair.c*5)::int,
      'sales_pair_'||md5(v_pair.a||'|'||v_pair.b)||'_'||to_char(CURRENT_DATE,'IYYY-IW'));
    v_recs := v_recs + 1;
  END LOOP;

  -- top-3 best sellers always
  FOR v_top IN
    WITH items AS (
      SELECT (it->>'name') AS name, COALESCE((it->>'qty')::numeric,1) AS qty,
             COALESCE((it->>'price')::numeric,0)*COALESCE((it->>'qty')::numeric,1) AS rev
      FROM public.orders o, jsonb_array_elements(COALESCE(o.items,'[]'::jsonb)) it
      WHERE o.created_at >= now() - interval '30 days' AND o.status <> 'cancelled'
    )
    SELECT name, SUM(qty) AS units, SUM(rev) AS rev FROM items
    WHERE name IS NOT NULL GROUP BY name ORDER BY SUM(rev) DESC NULLS LAST LIMIT 3
  LOOP
    PERFORM public._agent_rec_upsert('sales','sales',
      format('منتج رائج: %s', v_top.name),
      format('%s وحدة / %s ر.ي خلال 30 يوم — عزّز التوفر', round(v_top.units), round(v_top.rev)),
      jsonb_build_object('name',v_top.name,'units',v_top.units,'rev',v_top.rev),
      v_top.rev*0.15, 80,
      'sales_top_'||md5(v_top.name)||'_'||to_char(CURRENT_DATE,'IYYY-IW'));
    v_recs := v_recs + 1;
  END LOOP;

  PERFORM public._agent_kpi_upsert('sales','cross_sell_score',
    LEAST(100, v_recs*10)::numeric, jsonb_build_object('recs',v_recs,'orders_analyzed',v_total_orders));
  PERFORM public._agent_kpi_upsert('sales','upsell_score',
    CASE WHEN v_total_orders>0 THEN LEAST(100, v_recs*8)::numeric ELSE 0::numeric END,
    jsonb_build_object('orders_90d',v_total_orders));

  RETURN jsonb_build_object('findings_count', v_recs, 'recommendations_count', v_recs,
    'summary', format('%s توصية بيع من %s طلب', v_recs, v_total_orders),
    'details', jsonb_build_object('recs',v_recs));
END $fn$;

CREATE OR REPLACE FUNCTION public.run_inventory_worker()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_recs int := 0; v_low int := 0; v_oos int := 0; v_total int := 0;
        v_p RECORD; v_health numeric; v_risk numeric;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.products WHERE is_published AND track_stock;
  SELECT COUNT(*) INTO v_oos FROM public.products WHERE is_published AND track_stock AND stock_qty <= 0;
  SELECT COUNT(*) INTO v_low FROM public.products
    WHERE is_published AND track_stock AND stock_qty > 0 AND stock_qty <= COALESCE(reorder_point,10);

  -- emit recs for OOS + low stock + slow-mover
  FOR v_p IN
    SELECT id, name, stock_qty, reorder_point FROM public.products
    WHERE is_published AND track_stock AND (stock_qty <= 0 OR stock_qty <= COALESCE(reorder_point,10))
    ORDER BY stock_qty ASC LIMIT 15
  LOOP
    PERFORM public._agent_rec_upsert('inventory','inventory',
      CASE WHEN v_p.stock_qty <= 0 THEN format('نفاد: %s', v_p.name) ELSE format('شح: %s', v_p.name) END,
      format('المخزون %s / نقطة إعادة الطلب %s', v_p.stock_qty, COALESCE(v_p.reorder_point,10)),
      jsonb_build_object('product_id',v_p.id,'name',v_p.name,'stock',v_p.stock_qty),
      CASE WHEN v_p.stock_qty<=0 THEN 1500 ELSE 800 END, 90,
      'inv_'||v_p.id::text||'_'||to_char(CURRENT_DATE,'IYYY-IW'));
    v_recs := v_recs + 1;
  END LOOP;

  -- baseline inventory pulse
  PERFORM public._agent_rec_upsert('inventory','inventory',
    format('نبض المخزون: %s منتج / نفاد %s / شح %s', v_total, v_oos, v_low),
    'تقرير دوري لحالة المخزون',
    jsonb_build_object('total',v_total,'oos',v_oos,'low',v_low),
    0, 70, 'inv_pulse_'||to_char(CURRENT_DATE,'IYYY-IW'));
  v_recs := v_recs + 1;

  v_health := CASE WHEN v_total>0 THEN 100 - ((v_oos+v_low)::numeric/v_total*100) ELSE 100 END;
  v_risk := CASE WHEN v_total>0 THEN (v_oos+v_low)::numeric/v_total*100 ELSE 0 END;
  PERFORM public._agent_kpi_upsert('inventory','stock_health_score', v_health,
    jsonb_build_object('total',v_total,'oos',v_oos,'low',v_low));
  PERFORM public._agent_kpi_upsert('inventory','stockout_risk_score', v_risk,
    jsonb_build_object('oos',v_oos,'low',v_low));

  RETURN jsonb_build_object('findings_count', v_oos+v_low, 'recommendations_count', v_recs,
    'summary', format('%s نفاد / %s شح من %s', v_oos, v_low, v_total),
    'details', jsonb_build_object('oos',v_oos,'low',v_low,'total',v_total));
END $fn$;

CREATE OR REPLACE FUNCTION public.run_operations_worker()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_recs int := 0; v_pending_old int; v_proc_old int; v_o RECORD;
        v_total_7 int; v_done_7 int; v_sla numeric; v_fulfill numeric;
BEGIN
  SELECT COUNT(*) INTO v_pending_old FROM public.orders
    WHERE status='pending' AND created_at < now() - interval '2 hours';
  SELECT COUNT(*) INTO v_proc_old FROM public.orders
    WHERE status='processing' AND created_at < now() - interval '24 hours';

  FOR v_o IN
    SELECT id, customer_name, status, created_at,
      EXTRACT(EPOCH FROM (now()-created_at))/3600 AS hrs
    FROM public.orders
    WHERE (status='pending' AND created_at < now() - interval '2 hours')
       OR (status='processing' AND created_at < now() - interval '24 hours')
    ORDER BY created_at LIMIT 30
  LOOP
    INSERT INTO public.operations_alerts(kind, ref_id, summary, severity, dedupe_key)
    VALUES (
      CASE WHEN v_o.status='pending' THEN 'sla_breach' ELSE 'order_delay' END,
      v_o.id::text, format('طلب %s متأخر %s ساعة', v_o.id, round(v_o.hrs)),
      CASE WHEN v_o.hrs>48 THEN 'critical' WHEN v_o.hrs>12 THEN 'high' ELSE 'warn' END,
      'ops_'||v_o.id||'_'||v_o.status)
    ON CONFLICT (dedupe_key) DO UPDATE SET summary = EXCLUDED.summary, severity = EXCLUDED.severity;

    PERFORM public._agent_rec_upsert('operations','operations',
      format('تأخير طلب: %s', COALESCE(v_o.customer_name,'-')),
      format('متأخر %s ساعة بحالة %s', round(v_o.hrs), v_o.status),
      jsonb_build_object('order_id',v_o.id,'status',v_o.status,'hours',v_o.hrs),
      500, 85, 'ops_rec_'||v_o.id||'_'||v_o.status);
    v_recs := v_recs + 1;
  END LOOP;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE status IN ('completed','delivered','shipped'))
    INTO v_total_7, v_done_7 FROM public.orders WHERE created_at >= now()-interval '7 days';

  -- baseline operations digest
  PERFORM public._agent_rec_upsert('operations','operations',
    format('ملخص عمليات: %s طلب 7 أيام', v_total_7),
    format('مكتمل %s / متأخر %s', v_done_7, v_pending_old+v_proc_old),
    jsonb_build_object('orders_7d',v_total_7,'done',v_done_7,'overdue',v_pending_old+v_proc_old),
    0, 65, 'ops_digest_'||to_char(CURRENT_DATE,'IYYY-IW'));
  v_recs := v_recs + 1;

  v_sla := CASE WHEN v_total_7>0 THEN GREATEST(0, 100 - (v_pending_old+v_proc_old)::numeric/v_total_7*100) ELSE 100 END;
  v_fulfill := CASE WHEN v_total_7>0 THEN v_done_7::numeric/v_total_7*100 ELSE 0 END;
  PERFORM public._agent_kpi_upsert('operations','sla_score', v_sla,
    jsonb_build_object('pending_overdue',v_pending_old,'processing_overdue',v_proc_old));
  PERFORM public._agent_kpi_upsert('operations','fulfillment_score', v_fulfill,
    jsonb_build_object('orders_7d',v_total_7,'completed',v_done_7));
  RETURN jsonb_build_object('findings_count', v_pending_old+v_proc_old, 'recommendations_count', v_recs,
    'summary', format('%s متأخر، %s منجز', v_pending_old+v_proc_old, v_done_7),
    'details', jsonb_build_object('pending_old',v_pending_old,'processing_old',v_proc_old));
END $fn$;

CREATE OR REPLACE FUNCTION public.run_cx_worker()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_recs int := 0; v_at_risk int; v_loyal int; v_total int;
        v_retention numeric; v_churn_risk numeric; v_c RECORD;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.customer_scores;
  SELECT COUNT(*) INTO v_at_risk FROM public.customer_scores WHERE risk_score >= 50;
  SELECT COUNT(*) INTO v_loyal FROM public.customer_scores WHERE value_score >= 60;

  FOR v_c IN
    SELECT cs.phone, cp.name, cs.risk_score, cs.value_score, cs.segment, cp.total_spent
    FROM public.customer_scores cs
    LEFT JOIN public.customer_profiles cp ON cp.phone = cs.phone
    WHERE cs.risk_score >= 40 OR cs.value_score >= 60
    ORDER BY cs.risk_score DESC, cs.value_score DESC LIMIT 15
  LOOP
    PERFORM public._agent_rec_upsert('cx','cx',
      format('احتفاظ: %s', COALESCE(v_c.name, v_c.phone)),
      format('مخاطرة %s / قيمة %s', v_c.risk_score, v_c.value_score),
      jsonb_build_object('phone',v_c.phone,'risk',v_c.risk_score,'value',v_c.value_score,'discount_pct',12),
      COALESCE(v_c.total_spent,0)*0.3, 75,
      'cx_'||md5(v_c.phone)||'_'||to_char(CURRENT_DATE,'IYYY-IW'));
    v_recs := v_recs + 1;
  END LOOP;

  -- baseline CX digest
  PERFORM public._agent_rec_upsert('cx','cx',
    format('ملخص تجربة: %s عميل / %s مخلص / %s مخاطرة', v_total, v_loyal, v_at_risk),
    'تقرير دوري لجودة التجربة',
    jsonb_build_object('total',v_total,'loyal',v_loyal,'at_risk',v_at_risk),
    0, 65, 'cx_digest_'||to_char(CURRENT_DATE,'IYYY-IW'));
  v_recs := v_recs + 1;

  v_retention := CASE WHEN v_total>0 THEN v_loyal::numeric/v_total*100 ELSE 0 END;
  v_churn_risk := CASE WHEN v_total>0 THEN v_at_risk::numeric/v_total*100 ELSE 0 END;
  PERFORM public._agent_kpi_upsert('cx','retention_score', v_retention,
    jsonb_build_object('loyal',v_loyal,'total',v_total));
  PERFORM public._agent_kpi_upsert('cx','churn_risk_score', v_churn_risk,
    jsonb_build_object('at_risk',v_at_risk,'total',v_total));

  RETURN jsonb_build_object('findings_count', v_at_risk, 'recommendations_count', v_recs,
    'summary', format('%s مخاطرة / %s مخلصين / %s توصية', v_at_risk, v_loyal, v_recs),
    'details', jsonb_build_object('at_risk',v_at_risk,'loyal',v_loyal,'total',v_total));
END $fn$;

CREATE OR REPLACE FUNCTION public.run_bi_worker()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_recs int := 0; v_rev_7 numeric; v_rev_14 numeric; v_forecast numeric;
        v_top RECORD; v_growth_pct numeric; v_opp numeric;
BEGIN
  SELECT COALESCE(SUM(total),0) INTO v_rev_7 FROM public.orders
    WHERE created_at >= now()-interval '7 days' AND status <> 'cancelled';
  SELECT COALESCE(SUM(total),0) INTO v_rev_14 FROM public.orders
    WHERE created_at >= now()-interval '14 days' AND status <> 'cancelled';
  v_growth_pct := CASE WHEN (v_rev_14 - v_rev_7) > 0
    THEN (v_rev_7 - (v_rev_14-v_rev_7))/(v_rev_14-v_rev_7) ELSE 0 END;
  v_forecast := v_rev_7 * (1 + COALESCE(v_growth_pct,0));

  FOR v_top IN
    SELECT category, SUM(total) AS rev FROM public.orders o,
      LATERAL (SELECT DISTINCT p.category FROM jsonb_array_elements(COALESCE(o.items,'[]'::jsonb)) it
               JOIN public.products p ON p.legacy_id::text = it->>'id' OR p.id::text = it->>'id') c
    WHERE o.created_at >= now() - interval '90 days' AND o.status <> 'cancelled'
    GROUP BY category ORDER BY SUM(total) DESC NULLS LAST LIMIT 5
  LOOP
    PERFORM public._agent_rec_upsert('bi','bi',
      format('فئة رابحة: %s', COALESCE(v_top.category,'(غير مصنف)')),
      format('إيراد 90 يوم: %s ر.ي', round(v_top.rev)),
      jsonb_build_object('category',v_top.category,'revenue_90d',v_top.rev),
      v_top.rev*0.2, 70,
      'bi_top_'||md5(COALESCE(v_top.category,'_'))||'_'||to_char(CURRENT_DATE,'IYYY-IW'));
    v_recs := v_recs + 1;
  END LOOP;

  -- baseline forecast rec
  PERFORM public._agent_rec_upsert('bi','bi',
    format('توقع 7 أيام: %s ر.ي', round(v_forecast)),
    format('بناء على إيراد 7 أيام %s / نمو %s%%', round(v_rev_7), round(v_growth_pct*100)),
    jsonb_build_object('rev_7d',v_rev_7,'forecast',v_forecast,'growth_pct',v_growth_pct),
    v_forecast*0.05, 65, 'bi_forecast_'||to_char(CURRENT_DATE,'IYYY-IW'));
  v_recs := v_recs + 1;

  v_opp := LEAST(100, v_recs*15 + GREATEST(0, v_growth_pct*100));
  PERFORM public._agent_kpi_upsert('bi','forecast_accuracy_score', 50,
    jsonb_build_object('rev_7d',v_rev_7,'forecast_next_7d',v_forecast));
  PERFORM public._agent_kpi_upsert('bi','growth_opportunity_score', v_opp,
    jsonb_build_object('top_categories',v_recs,'growth_pct',v_growth_pct));

  RETURN jsonb_build_object('findings_count', v_recs, 'recommendations_count', v_recs,
    'summary', format('إيراد 7 أيام %s / توقع %s', round(v_rev_7), round(v_forecast)),
    'details', jsonb_build_object('rev_7d',v_rev_7,'forecast',v_forecast));
END $fn$;

-- ============================================================================
-- PHASE 3: agent_actions table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agent_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid REFERENCES public.agent_recommendations(id) ON DELETE SET NULL,
  agent_name text NOT NULL,
  action_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','executed','failed','cancelled')),
  approved_by uuid,
  approved_at timestamptz,
  executed_at timestamptz,
  result jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.agent_actions TO authenticated;
GRANT ALL ON public.agent_actions TO service_role;
ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read agent_actions" ON public.agent_actions FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin'));
CREATE POLICY "admins write agent_actions" ON public.agent_actions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin'));
CREATE INDEX agent_actions_status_idx ON public.agent_actions(status, created_at DESC);
CREATE INDEX agent_actions_agent_idx ON public.agent_actions(agent_name, created_at DESC);

-- function: generate pending actions from open recommendations
CREATE OR REPLACE FUNCTION public.generate_agent_actions()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_count int := 0;
BEGIN
  INSERT INTO public.agent_actions(recommendation_id, agent_name, action_type, payload, status)
  SELECT r.id, r.agent_name,
    CASE r.agent_name
      WHEN 'marketing' THEN 'send_campaign'
      WHEN 'cx' THEN 'send_retention_offer'
      WHEN 'inventory' THEN 'create_purchase_order'
      WHEN 'operations' THEN 'escalate_order'
      WHEN 'sales' THEN 'create_bundle'
      WHEN 'cto' THEN 'create_incident'
      WHEN 'bi' THEN 'log_insight'
      ELSE 'review'
    END,
    r.payload, 'pending'
  FROM public.agent_recommendations r
  WHERE r.status = 'open'
    AND r.created_at >= now() - interval '7 days'
    AND NOT EXISTS (SELECT 1 FROM public.agent_actions a WHERE a.recommendation_id = r.id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $fn$;

-- ============================================================================
-- PHASE 4 & 5: Delivery log tables
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_kind text NOT NULL,
  recipient_phone text NOT NULL,
  template_name text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  wamid text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','read','failed')),
  error_message text,
  ref_kind text,
  ref_id text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_delivery_logs TO authenticated;
GRANT ALL ON public.whatsapp_delivery_logs TO service_role;
ALTER TABLE public.whatsapp_delivery_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read wa logs" ON public.whatsapp_delivery_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin'));
CREATE POLICY "admins write wa logs" ON public.whatsapp_delivery_logs FOR ALL TO authenticated
  USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin'));
CREATE INDEX wa_logs_recipient_idx ON public.whatsapp_delivery_logs(recipient_phone, created_at DESC);
CREATE INDEX wa_logs_status_idx ON public.whatsapp_delivery_logs(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.email_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  recipient_email text NOT NULL,
  subject text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  message_id text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','bounced','failed')),
  error_message text,
  ref_kind text,
  ref_id text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.email_delivery_logs TO authenticated;
GRANT ALL ON public.email_delivery_logs TO service_role;
ALTER TABLE public.email_delivery_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read email logs" ON public.email_delivery_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin'));
CREATE POLICY "admins write email logs" ON public.email_delivery_logs FOR ALL TO authenticated
  USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin'));
CREATE INDEX email_logs_recipient_idx ON public.email_delivery_logs(recipient_email, created_at DESC);
CREATE INDEX email_logs_status_idx ON public.email_delivery_logs(status, created_at DESC);

-- ============================================================================
-- PHASE 6: Auto-populate bundles + hide empty
-- ============================================================================
CREATE OR REPLACE FUNCTION public.auto_populate_bundle_items()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_b RECORD; v_inserted int := 0; v_cat_filter text;
BEGIN
  FOR v_b IN SELECT id, kind, slug FROM public.bundles WHERE is_active LOOP
    IF EXISTS (SELECT 1 FROM public.bundle_items WHERE bundle_id = v_b.id) THEN CONTINUE; END IF;
    v_cat_filter := CASE v_b.kind
      WHEN 'cold_flu' THEN 'medicine'
      WHEN 'diabetes' THEN 'medicine'
      WHEN 'blood_pressure' THEN 'medicine'
      WHEN 'heart' THEN 'medicine'
      WHEN 'baby_care' THEN 'baby'
      WHEN 'vitamins' THEN 'vitamins'
      WHEN 'women_care' THEN 'beauty'
      WHEN 'first_aid' THEN 'medicine'
      ELSE 'medicine'
    END;
    INSERT INTO public.bundle_items(bundle_id, product_legacy_id, qty)
    SELECT v_b.id, p.legacy_id, 1
    FROM public.products p
    WHERE p.is_published AND p.legacy_id IS NOT NULL
      AND (p.category = v_cat_filter OR (v_cat_filter='baby' AND p.category ILIKE '%baby%'))
    ORDER BY random() LIMIT 4;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
  END LOOP;

  -- hide bundles still empty
  UPDATE public.bundles b SET is_active = false
  WHERE is_active AND NOT EXISTS (SELECT 1 FROM public.bundle_items i WHERE i.bundle_id = b.id);

  RETURN v_inserted;
END $fn$;

-- ============================================================================
-- PHASE 7: Marketing campaign generator (writes to marketing_queue)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generate_marketing_campaigns()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_dormant int := 0; v_chronic int := 0; v_seasonal int := 0;
BEGIN
  -- dormant 30+ days
  INSERT INTO public.marketing_queue(campaign_kind, customer_phone, customer_name, segment, reason, message_text, payload)
  SELECT 'dormant_reactivation', cp.phone, cp.name, 'dormant',
    format('بدون طلب منذ %s يوم', EXTRACT(DAY FROM now()-cp.last_order_at)::int),
    format('مرحباً %s 👋 اشتقنا لك! خصم 10%% على طلبك القادم بكود WELCOME10. صيدلية مصلي.',
      COALESCE(cp.name,'عميلنا الكريم')),
    jsonb_build_object('discount_pct',10,'code','WELCOME10','days_inactive',EXTRACT(DAY FROM now()-cp.last_order_at)::int)
  FROM public.customer_profiles cp
  WHERE cp.last_order_at < now() - interval '30 days' AND cp.orders_count >= 1
    AND NOT EXISTS (
      SELECT 1 FROM public.marketing_queue mq
      WHERE mq.customer_phone = cp.phone AND mq.campaign_kind = 'dormant_reactivation'
        AND mq.generated_at > now() - interval '14 days'
    )
  LIMIT 50;
  GET DIAGNOSTICS v_dormant = ROW_COUNT;

  -- chronic refills
  INSERT INTO public.marketing_queue(campaign_kind, customer_phone, customer_name, segment, reason, message_text, payload)
  SELECT 'chronic_refill', cp.phone, cp.name, 'chronic',
    'مريض مزمن - تذكير إعادة صرف',
    format('مرحباً %s 💊 حان وقت إعادة صرف أدويتك المزمنة. اطلب الآن مع توصيل مجاني.',
      COALESCE(cp.name,'عميلنا')),
    jsonb_build_object('discount_pct',15,'segment','chronic','flags',cp.chronic_flags)
  FROM public.customer_profiles cp
  WHERE jsonb_typeof(cp.chronic_flags) = 'array'
    AND jsonb_array_length(cp.chronic_flags) > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.marketing_queue mq
      WHERE mq.customer_phone = cp.phone AND mq.campaign_kind = 'chronic_refill'
        AND mq.generated_at > now() - interval '30 days'
    )
  LIMIT 50;
  GET DIAGNOSTICS v_chronic = ROW_COUNT;

  -- seasonal (active customers)
  INSERT INTO public.marketing_queue(campaign_kind, customer_phone, customer_name, segment, reason, message_text, payload)
  SELECT 'seasonal_offer', cp.phone, cp.name, 'engaged',
    'حملة موسمية',
    format('عرض الموسم 🌟 خصم 12%% على باقات الفيتامينات والمناعة. كود SEASON12'),
    jsonb_build_object('discount_pct',12,'code','SEASON12','bundle','vitamins')
  FROM public.customer_profiles cp
  WHERE cp.last_order_at >= now() - interval '60 days'
    AND NOT EXISTS (
      SELECT 1 FROM public.marketing_queue mq
      WHERE mq.customer_phone = cp.phone AND mq.campaign_kind = 'seasonal_offer'
        AND mq.generated_at > now() - interval '21 days'
    )
  LIMIT 30;
  GET DIAGNOSTICS v_seasonal = ROW_COUNT;

  RETURN jsonb_build_object('dormant',v_dormant,'chronic',v_chronic,'seasonal',v_seasonal,
    'total', v_dormant + v_chronic + v_seasonal);
END $fn$;
