
-- ============ 1. EXTEND agent_runs ============
ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS findings_count int,
  ADD COLUMN IF NOT EXISTS recommendations_count int,
  ADD COLUMN IF NOT EXISTS execution_time_ms int;

-- ============ 2. NEW TABLES ============
CREATE TABLE IF NOT EXISTS public.agent_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  rationale text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  impact_estimate numeric,
  confidence int,
  status text NOT NULL DEFAULT 'open',
  dedupe_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS agent_recommendations_dedupe
  ON public.agent_recommendations(agent_name, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS agent_recommendations_recent
  ON public.agent_recommendations(agent_name, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.agent_recommendations TO authenticated;
GRANT ALL ON public.agent_recommendations TO service_role;
ALTER TABLE public.agent_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read recs" ON public.agent_recommendations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins update recs" ON public.agent_recommendations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.agent_kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL,
  metric text NOT NULL,
  score numeric,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  as_of date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_name, metric, as_of)
);
CREATE INDEX IF NOT EXISTS agent_kpis_recent ON public.agent_kpis(agent_name, as_of DESC);
GRANT SELECT, INSERT, UPDATE ON public.agent_kpis TO authenticated;
GRANT ALL ON public.agent_kpis TO service_role;
ALTER TABLE public.agent_kpis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read kpis" ON public.agent_kpis FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.system_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  severity text NOT NULL DEFAULT 'warn',
  title text NOT NULL,
  summary text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text,
  status text NOT NULL DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS system_incidents_dedupe ON public.system_incidents(dedupe_key)
  WHERE dedupe_key IS NOT NULL AND status='open';
GRANT SELECT, INSERT, UPDATE ON public.system_incidents TO authenticated;
GRANT ALL ON public.system_incidents TO service_role;
ALTER TABLE public.system_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read incidents" ON public.system_incidents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins update incidents" ON public.system_incidents FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.operations_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  ref_id text,
  summary text NOT NULL,
  severity text NOT NULL DEFAULT 'warn',
  dedupe_key text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS operations_alerts_dedupe ON public.operations_alerts(dedupe_key)
  WHERE dedupe_key IS NOT NULL AND status='open';
GRANT SELECT, INSERT, UPDATE ON public.operations_alerts TO authenticated;
GRANT ALL ON public.operations_alerts TO service_role;
ALTER TABLE public.operations_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read ops alerts" ON public.operations_alerts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins update ops alerts" ON public.operations_alerts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

-- ============ 3. helper: upsert KPI ============
CREATE OR REPLACE FUNCTION public._agent_kpi_upsert(_agent text, _metric text, _score numeric, _details jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  INSERT INTO public.agent_kpis(agent_name, metric, score, details, as_of)
  VALUES (_agent, _metric, _score, COALESCE(_details,'{}'::jsonb), CURRENT_DATE)
  ON CONFLICT (agent_name, metric, as_of) DO UPDATE
    SET score = EXCLUDED.score, details = EXCLUDED.details;
$$;

CREATE OR REPLACE FUNCTION public._agent_rec_upsert(_agent text, _category text, _title text, _rationale text, _payload jsonb, _impact numeric, _confidence int, _dedupe text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.agent_recommendations(agent_name, category, title, rationale, payload, impact_estimate, confidence, dedupe_key)
  VALUES (_agent, _category, _title, _rationale, COALESCE(_payload,'{}'::jsonb), _impact, _confidence, _dedupe)
  ON CONFLICT (agent_name, dedupe_key) DO UPDATE
    SET title = EXCLUDED.title, rationale = EXCLUDED.rationale, payload = EXCLUDED.payload,
        impact_estimate = EXCLUDED.impact_estimate, confidence = EXCLUDED.confidence,
        updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- ============ 4. WORKER FUNCTIONS ============
-- All return jsonb {findings_count, recommendations_count, summary, details}

-- CEO: revenue WoW + margin + executive_reports row
CREATE OR REPLACE FUNCTION public.run_ceo_worker()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_rev_7 numeric := 0; v_rev_prev numeric := 0; v_growth numeric;
  v_orders_7 int := 0; v_aov numeric := 0;
  v_margin numeric := 0; v_recs int := 0;
  v_growth_score numeric; v_profit_score numeric;
BEGIN
  SELECT COALESCE(SUM(total),0), COUNT(*) INTO v_rev_7, v_orders_7
    FROM public.orders WHERE created_at >= now() - interval '7 days' AND status <> 'cancelled';
  SELECT COALESCE(SUM(total),0) INTO v_rev_prev
    FROM public.orders WHERE created_at >= now() - interval '14 days'
      AND created_at < now() - interval '7 days' AND status <> 'cancelled';
  v_growth := CASE WHEN v_rev_prev > 0 THEN (v_rev_7 - v_rev_prev) / v_rev_prev * 100 ELSE NULL END;
  v_aov := CASE WHEN v_orders_7>0 THEN v_rev_7/v_orders_7 ELSE 0 END;

  -- gross margin proxy from products in recent orders
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

  IF v_growth IS NOT NULL AND v_growth < -10 THEN
    PERFORM public._agent_rec_upsert('ceo','executive','تراجع إيراد أسبوعي',
      format('انخفض الإيراد %.1f%% مقارنة بالأسبوع السابق. مراجعة الحملات والمخزون.', v_growth),
      jsonb_build_object('rev_7d',v_rev_7,'rev_prev',v_rev_prev), v_rev_prev - v_rev_7, 80,
      'ceo_revdrop_'||to_char(CURRENT_DATE,'IYYY-IW'));
    v_recs := v_recs + 1;
  ELSIF v_growth IS NOT NULL AND v_growth > 10 THEN
    PERFORM public._agent_rec_upsert('ceo','executive','نمو إيراد قوي',
      format('نمو %.1f%% — وسّع الميزانية التسويقية للفئات الرابحة.', v_growth),
      jsonb_build_object('rev_7d',v_rev_7), v_rev_7 - v_rev_prev, 75,
      'ceo_revup_'||to_char(CURRENT_DATE,'IYYY-IW'));
    v_recs := v_recs + 1;
  END IF;
  IF v_margin < 20 AND v_rev_7 > 0 THEN
    PERFORM public._agent_rec_upsert('ceo','executive','هامش ربح منخفض',
      format('الهامش الإجمالي %.1f%% — راجع تسعير المنتجات الأكثر مبيعاً.', v_margin),
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
END $$;

-- CTO: monitor errors + uptime + open incidents
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

  -- cluster errors by source+left(message,80)
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
    ON CONFLICT (dedupe_key) WHERE status='open' DO NOTHING;
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

-- SALES: cross-sell / upsell from co-purchase
CREATE OR REPLACE FUNCTION public.run_sales_worker()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_recs int := 0; v_pair RECORD; v_total_orders int;
BEGIN
  SELECT COUNT(*) INTO v_total_orders FROM public.orders
    WHERE created_at >= now() - interval '60 days' AND status <> 'cancelled';

  -- top co-purchase pairs in last 60 days
  FOR v_pair IN
    WITH items AS (
      SELECT o.id AS oid, (it->>'name') AS name, (it->>'id') AS pid
      FROM public.orders o, jsonb_array_elements(COALESCE(o.items,'[]'::jsonb)) it
      WHERE o.created_at >= now() - interval '60 days' AND o.status <> 'cancelled'
    ), pairs AS (
      SELECT a.name AS a, b.name AS b, COUNT(DISTINCT a.oid) AS c
      FROM items a JOIN items b ON a.oid = b.oid AND a.name < b.name
      WHERE a.name IS NOT NULL AND b.name IS NOT NULL
      GROUP BY a.name, b.name HAVING COUNT(DISTINCT a.oid) >= 3
    )
    SELECT * FROM pairs ORDER BY c DESC LIMIT 10
  LOOP
    PERFORM public._agent_rec_upsert('sales','sales',
      format('عرض مشترك: %s + %s', v_pair.a, v_pair.b),
      format('تم شراؤهما معاً في %s طلبات. اقترحهما كحزمة بخصم 5-8%%.', v_pair.c),
      jsonb_build_object('item_a',v_pair.a,'item_b',v_pair.b,'co_count',v_pair.c),
      v_pair.c * 500, LEAST(95, 40 + v_pair.c*5),
      'sales_pair_'||md5(v_pair.a||'|'||v_pair.b)||'_'||to_char(CURRENT_DATE,'IYYY-IW'));
    v_recs := v_recs + 1;
  END LOOP;

  PERFORM public._agent_kpi_upsert('sales','cross_sell_score',
    LEAST(100, v_recs*10), jsonb_build_object('pairs_found',v_recs,'orders_analyzed',v_total_orders));
  PERFORM public._agent_kpi_upsert('sales','upsell_score',
    CASE WHEN v_total_orders>0 THEN LEAST(100, v_recs*8) ELSE 0 END,
    jsonb_build_object('orders_60d',v_total_orders));

  RETURN jsonb_build_object('findings_count', v_recs, 'recommendations_count', v_recs,
    'summary', format('%s فرصة بيع مشترك من تحليل %s طلب', v_recs, v_total_orders),
    'details', jsonb_build_object('pairs',v_recs));
END $$;

-- INVENTORY: stock health + reorder predictions
CREATE OR REPLACE FUNCTION public.run_inventory_worker()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_recs int := 0; v_low int := 0; v_oos int := 0; v_total int := 0;
        v_p RECORD; v_health numeric; v_risk numeric;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.products WHERE is_published AND track_stock;
  SELECT COUNT(*) INTO v_oos FROM public.products WHERE is_published AND track_stock AND stock_qty <= 0;
  SELECT COUNT(*) INTO v_low FROM public.products
    WHERE is_published AND track_stock AND stock_qty > 0 AND stock_qty <= COALESCE(reorder_point,5);

  -- predict stockouts from 14-day velocity
  FOR v_p IN
    WITH sales AS (
      SELECT (it->>'id') AS pid, SUM(COALESCE((it->>'qty')::numeric,1)) AS qty_14d
      FROM public.orders o, jsonb_array_elements(COALESCE(o.items,'[]'::jsonb)) it
      WHERE o.created_at >= now() - interval '14 days' AND o.status <> 'cancelled'
      GROUP BY (it->>'id')
    )
    SELECT p.id, p.name, p.stock_qty, p.reorder_point, COALESCE(s.qty_14d,0) AS qty_14d,
           CASE WHEN s.qty_14d > 0 THEN (p.stock_qty::numeric / (s.qty_14d/14.0)) ELSE NULL END AS days_left
    FROM public.products p
    LEFT JOIN sales s ON s.pid = p.legacy_id::text OR s.pid = p.id::text
    WHERE p.is_published AND p.track_stock
      AND ((s.qty_14d > 0 AND p.stock_qty::numeric/(s.qty_14d/14.0) < 7) OR p.stock_qty <= COALESCE(p.reorder_point,5))
    ORDER BY days_left NULLS LAST LIMIT 20
  LOOP
    PERFORM public._agent_rec_upsert('inventory','inventory',
      format('إعادة طلب: %s', v_p.name),
      format('مخزون %s — حركة 14 يوم %s — يكفي تقريباً %s يوم', v_p.stock_qty, v_p.qty_14d, COALESCE(round(v_p.days_left)::text,'∞')),
      jsonb_build_object('product_id',v_p.id,'stock',v_p.stock_qty,'velocity_14d',v_p.qty_14d,'days_left',v_p.days_left),
      v_p.qty_14d * 100, 85,
      'inv_'||v_p.id::text||'_'||to_char(CURRENT_DATE,'IYYY-MM-DD'));
    v_recs := v_recs + 1;
  END LOOP;

  v_health := CASE WHEN v_total>0 THEN GREATEST(0, 100 - (v_oos*5.0 + v_low*1.5)/v_total*100) ELSE 100 END;
  v_risk := CASE WHEN v_total>0 THEN LEAST(100, (v_oos*10.0 + v_low*3.0)/v_total*100) ELSE 0 END;

  PERFORM public._agent_kpi_upsert('inventory','stock_health_score', v_health,
    jsonb_build_object('total',v_total,'out_of_stock',v_oos,'low',v_low));
  PERFORM public._agent_kpi_upsert('inventory','stockout_risk_score', v_risk,
    jsonb_build_object('at_risk',v_recs));

  RETURN jsonb_build_object('findings_count', v_oos + v_low, 'recommendations_count', v_recs,
    'summary', format('%s منتج نافد / %s منخفض / %s توصية إعادة طلب', v_oos, v_low, v_recs),
    'details', jsonb_build_object('oos',v_oos,'low',v_low,'recs',v_recs));
END $$;

-- OPERATIONS: SLA on pending / processing orders
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
    ON CONFLICT (dedupe_key) WHERE status='open' DO NOTHING;
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

-- MARKETING: dormant + chronic + seasonal
CREATE OR REPLACE FUNCTION public.run_marketing_worker()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_recs int := 0; v_dormant int; v_chronic int; v_engaged int; v_total int;
        v_engagement numeric; v_readiness numeric;
BEGIN
  SELECT COUNT(*) INTO v_dormant FROM public.customer_profiles
    WHERE last_order_at < now() - interval '60 days' AND orders_count >= 2;
  SELECT COUNT(*) INTO v_chronic FROM public.customer_profiles
    WHERE chronic_flags IS NOT NULL AND jsonb_array_length(COALESCE(chronic_flags,'[]'::jsonb)) > 0;
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

-- CX: churn risk + retention
CREATE OR REPLACE FUNCTION public.run_cx_worker()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_recs int := 0; v_at_risk int; v_loyal int; v_total int;
        v_retention numeric; v_churn_risk numeric; v_c RECORD;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.customer_scores;
  SELECT COUNT(*) INTO v_at_risk FROM public.customer_scores WHERE risk_score >= 60;
  SELECT COUNT(*) INTO v_loyal FROM public.customer_scores WHERE value_score >= 70 AND health_score >= 60;

  FOR v_c IN
    SELECT cs.phone, cp.name, cs.risk_score, cs.value_score, cs.segment, cp.total_spent, cp.last_order_at
    FROM public.customer_scores cs
    LEFT JOIN public.customer_profiles cp ON cp.phone = cs.phone
    WHERE cs.risk_score >= 60 AND cs.value_score >= 50
    ORDER BY cs.risk_score DESC, cs.value_score DESC LIMIT 15
  LOOP
    PERFORM public._agent_rec_upsert('cx','cx',
      format('احتفاظ: %s', COALESCE(v_c.name, v_c.phone)),
      format('مخاطرة %s / قيمة %s — أرسل واتساب شخصي + خصم 12%%', v_c.risk_score, v_c.value_score),
      jsonb_build_object('phone',v_c.phone,'risk',v_c.risk_score,'value',v_c.value_score,'segment',v_c.segment,'discount_pct',12),
      COALESCE(v_c.total_spent,0)*0.3, 75,
      'cx_'||md5(v_c.phone)||'_'||to_char(CURRENT_DATE,'IYYY-IW'));
    v_recs := v_recs + 1;
  END LOOP;

  v_retention := CASE WHEN v_total>0 THEN v_loyal::numeric/v_total*100 ELSE 0 END;
  v_churn_risk := CASE WHEN v_total>0 THEN v_at_risk::numeric/v_total*100 ELSE 0 END;

  PERFORM public._agent_kpi_upsert('cx','retention_score', v_retention,
    jsonb_build_object('loyal',v_loyal,'total',v_total));
  PERFORM public._agent_kpi_upsert('cx','churn_risk_score', v_churn_risk,
    jsonb_build_object('at_risk',v_at_risk,'total',v_total));

  RETURN jsonb_build_object('findings_count', v_at_risk, 'recommendations_count', v_recs,
    'summary', format('%s عميل بمخاطرة churn / %s مخلصين / %s خطة احتفاظ', v_at_risk, v_loyal, v_recs),
    'details', jsonb_build_object('at_risk',v_at_risk,'loyal',v_loyal,'total',v_total));
END $$;

-- BI: trends + forecast
CREATE OR REPLACE FUNCTION public.run_bi_worker()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_recs int := 0; v_rev_7 numeric; v_rev_14 numeric; v_forecast numeric;
        v_top RECORD; v_growth_pct numeric; v_opp numeric; v_acc numeric;
        v_prior numeric;
BEGIN
  SELECT COALESCE(SUM(total),0) INTO v_rev_7 FROM public.orders
    WHERE created_at >= now()-interval '7 days' AND status <> 'cancelled';
  SELECT COALESCE(SUM(total),0) INTO v_rev_14 FROM public.orders
    WHERE created_at >= now()-interval '14 days' AND status <> 'cancelled';
  -- naive 7-day forecast = last 7 * (1 + growth)
  v_growth_pct := CASE WHEN (v_rev_14 - v_rev_7) > 0 THEN (v_rev_7 - (v_rev_14-v_rev_7))/(v_rev_14-v_rev_7) ELSE 0 END;
  v_forecast := v_rev_7 * (1 + COALESCE(v_growth_pct,0));

  -- forecast accuracy vs yesterday's stored forecast
  SELECT (details->>'forecast_next_7d')::numeric INTO v_prior FROM public.agent_kpis
    WHERE agent_name='bi' AND metric='forecast_accuracy_score' AND as_of = CURRENT_DATE - 7 LIMIT 1;
  v_acc := CASE WHEN v_prior IS NOT NULL AND v_prior > 0
              THEN GREATEST(0, 100 - LEAST(100, ABS(v_rev_7 - v_prior)/v_prior*100))
              ELSE NULL END;

  FOR v_top IN
    SELECT category, SUM(total) AS rev FROM public.orders o,
      LATERAL (SELECT DISTINCT p.category FROM jsonb_array_elements(COALESCE(o.items,'[]'::jsonb)) it
               JOIN public.products p ON p.legacy_id::text = it->>'id' OR p.id::text = it->>'id') c
    WHERE o.created_at >= now() - interval '30 days' AND o.status <> 'cancelled'
    GROUP BY category ORDER BY SUM(total) DESC NULLS LAST LIMIT 5
  LOOP
    PERFORM public._agent_rec_upsert('bi','bi',
      format('فئة رابحة: %s', COALESCE(v_top.category,'(غير مصنف)')),
      format('إيراد 30 يوم: %s ر.ي — وسّع التشكيلة والحملات', round(v_top.rev)),
      jsonb_build_object('category',v_top.category,'revenue_30d',v_top.rev),
      v_top.rev*0.2, 70,
      'bi_top_'||md5(COALESCE(v_top.category,'_'))||'_'||to_char(CURRENT_DATE,'IYYY-IW'));
    v_recs := v_recs + 1;
  END LOOP;

  v_opp := LEAST(100, v_recs*15 + GREATEST(0, v_growth_pct*100));

  PERFORM public._agent_kpi_upsert('bi','forecast_accuracy_score', COALESCE(v_acc, 50),
    jsonb_build_object('rev_7d',v_rev_7,'forecast_next_7d',v_forecast,'prior_forecast',v_prior,'accuracy_pct',v_acc));
  PERFORM public._agent_kpi_upsert('bi','growth_opportunity_score', v_opp,
    jsonb_build_object('top_categories',v_recs,'growth_pct',v_growth_pct));

  RETURN jsonb_build_object('findings_count', v_recs, 'recommendations_count', v_recs,
    'summary', format('إيراد 7 أيام %s / توقع 7 أيام قادمة %s / %s فئة رابحة',
      round(v_rev_7), round(v_forecast), v_recs),
    'details', jsonb_build_object('rev_7d',v_rev_7,'forecast',v_forecast,'top_cats',v_recs));
END $$;

-- ============ 5. Dispatcher: run_all_agents_now ============
CREATE OR REPLACE FUNCTION public.run_all_agents_now()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_results jsonb := '{}'::jsonb; v_agents text[] := ARRAY['ceo','cto','sales','inventory','operations','marketing','cx','bi'];
        v_a text; v_run_id uuid; v_start timestamptz; v_res jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  FOREACH v_a IN ARRAY v_agents LOOP
    v_start := clock_timestamp();
    INSERT INTO public.agent_runs(agent, kind, status, started_at)
      VALUES (v_a, 'manual', 'running', v_start) RETURNING id INTO v_run_id;
    BEGIN
      EXECUTE format('SELECT public.run_%I_worker()', v_a) INTO v_res;
      UPDATE public.agent_runs SET status='ok', finished_at=now(),
        summary = v_res->>'summary', details = v_res,
        findings_count = (v_res->>'findings_count')::int,
        recommendations_count = (v_res->>'recommendations_count')::int,
        execution_time_ms = EXTRACT(MILLISECONDS FROM (clock_timestamp()-v_start))::int
      WHERE id = v_run_id;
      v_results := v_results || jsonb_build_object(v_a, v_res);
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.agent_runs SET status='error', finished_at=now(),
        summary = SQLERRM,
        execution_time_ms = EXTRACT(MILLISECONDS FROM (clock_timestamp()-v_start))::int
      WHERE id = v_run_id;
      v_results := v_results || jsonb_build_object(v_a, jsonb_build_object('error', SQLERRM));
    END;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'results', v_results, 'ran_at', now());
END $$;

-- ============ 6. Extend rotate_cron_secret with 8 new jobs ============
CREATE OR REPLACE FUNCTION public.rotate_cron_secret(_secret text, _base_url text DEFAULT 'https://project--4d4aad01-9bf4-4d8b-acab-e51a06a17c63.lovable.app')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_headers jsonb; v_rescheduled int := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _secret IS NULL OR length(_secret) < 16 THEN RAISE EXCEPTION 'cron secret too short'; END IF;
  v_headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', _secret);

  PERFORM cron.unschedule(jobname) FROM cron.job WHERE jobname IN (
    'muslly-nightly-intel','weekly-ai-enrich','weekly-exec-report','staff-alerts-worker',
    'incident-alert-dispatch','muslly-chronic-refills',
    'muslly-agent-ceo','muslly-agent-cto','muslly-agent-sales','muslly-agent-inventory',
    'muslly-agent-operations','muslly-agent-marketing','muslly-agent-cx','muslly-agent-bi');

  PERFORM cron.schedule('muslly-nightly-intel','30 23 * * *',
    format($f$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb);$f$,
    _base_url||'/api/public/hooks/nightly-intel', v_headers::text));
  PERFORM cron.schedule('weekly-ai-enrich','0 3 * * 0',
    format($f$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{"limit":50}'::jsonb);$f$,
    _base_url||'/api/public/hooks/weekly-ai-enrich', v_headers::text));
  PERFORM cron.schedule('weekly-exec-report','30 3 * * 0',
    format($f$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb);$f$,
    _base_url||'/api/public/hooks/weekly-exec-report', v_headers::text));
  PERFORM cron.schedule('staff-alerts-worker','* * * * *',
    format($f$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb);$f$,
    _base_url||'/api/public/hooks/alerts-worker', v_headers::text));
  PERFORM cron.schedule('incident-alert-dispatch','*/5 * * * *',
    format($f$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb);$f$,
    _base_url||'/api/public/incident-check', v_headers::text));
  PERFORM cron.schedule('muslly-chronic-refills','0 9 * * 1',
    format($f$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{"discount_pct":15,"limit":50}'::jsonb);$f$,
    _base_url||'/api/public/hooks/chronic-refills', v_headers::text));
  v_rescheduled := 6;

  PERFORM cron.schedule('muslly-agent-ceo','0 4 * * *',
    format($f$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb);$f$,
    _base_url||'/api/public/hooks/agents/ceo', v_headers::text));
  PERFORM cron.schedule('muslly-agent-cto','*/15 * * * *',
    format($f$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb);$f$,
    _base_url||'/api/public/hooks/agents/cto', v_headers::text));
  PERFORM cron.schedule('muslly-agent-sales','30 4 * * *',
    format($f$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb);$f$,
    _base_url||'/api/public/hooks/agents/sales', v_headers::text));
  PERFORM cron.schedule('muslly-agent-inventory','0 5 * * *',
    format($f$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb);$f$,
    _base_url||'/api/public/hooks/agents/inventory', v_headers::text));
  PERFORM cron.schedule('muslly-agent-operations','*/10 * * * *',
    format($f$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb);$f$,
    _base_url||'/api/public/hooks/agents/operations', v_headers::text));
  PERFORM cron.schedule('muslly-agent-marketing','0 6 * * *',
    format($f$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb);$f$,
    _base_url||'/api/public/hooks/agents/marketing', v_headers::text));
  PERFORM cron.schedule('muslly-agent-cx','30 6 * * *',
    format($f$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb);$f$,
    _base_url||'/api/public/hooks/agents/cx', v_headers::text));
  PERFORM cron.schedule('muslly-agent-bi','0 7 * * *',
    format($f$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb);$f$,
    _base_url||'/api/public/hooks/agents/bi', v_headers::text));
  v_rescheduled := v_rescheduled + 8;

  RETURN jsonb_build_object('ok', true, 'rescheduled', v_rescheduled, 'rotated_at', now());
END $$;

-- ============ 7. workforce summary RPC ============
CREATE OR REPLACE FUNCTION public.agent_workforce_summary()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_out jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  WITH last_run AS (
    SELECT DISTINCT ON (agent) agent, started_at, finished_at, status, summary,
           findings_count, recommendations_count, execution_time_ms
    FROM public.agent_runs ORDER BY agent, started_at DESC
  ), kpis AS (
    SELECT agent_name, jsonb_agg(jsonb_build_object('metric',metric,'score',score,'details',details) ORDER BY metric) AS metrics,
           AVG(score) AS avg_score
    FROM public.agent_kpis WHERE as_of >= CURRENT_DATE - 1 GROUP BY agent_name
  ), recs AS (
    SELECT agent_name, COUNT(*) FILTER (WHERE status='open' AND created_at >= now() - interval '7 days') AS open_recs
    FROM public.agent_recommendations GROUP BY agent_name
  ), agents AS (
    SELECT unnest(ARRAY['ceo','cto','sales','inventory','operations','marketing','cx','bi']) AS name
  )
  SELECT jsonb_build_object(
    'agents', jsonb_agg(jsonb_build_object(
      'name', a.name,
      'last_run', to_jsonb(lr.*),
      'kpis', k.metrics,
      'avg_kpi', k.avg_score,
      'open_recommendations', COALESCE(r.open_recs, 0)
    ) ORDER BY a.name),
    'readiness_score', (SELECT AVG(avg_score) FROM kpis),
    'as_of', now()
  ) INTO v_out
  FROM agents a
    LEFT JOIN last_run lr ON lr.agent = a.name
    LEFT JOIN kpis k ON k.agent_name = a.name
    LEFT JOIN recs r ON r.agent_name = a.name;
  RETURN v_out;
END $$;

GRANT EXECUTE ON FUNCTION public.run_all_agents_now() TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_workforce_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_ceo_worker() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.run_cto_worker() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.run_sales_worker() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.run_inventory_worker() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.run_operations_worker() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.run_marketing_worker() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.run_cx_worker() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.run_bi_worker() TO authenticated, service_role;
