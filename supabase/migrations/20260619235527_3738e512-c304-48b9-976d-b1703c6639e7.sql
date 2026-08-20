
-- ============================================================
-- BATCH 1: Pharmacy Intelligence Foundation (v2)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.customer_profiles (
  phone text PRIMARY KEY,
  name text,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_order_at timestamptz,
  orders_count int NOT NULL DEFAULT 0,
  cancelled_count int NOT NULL DEFAULT 0,
  total_spent numeric NOT NULL DEFAULT 0,
  avg_order_value numeric NOT NULL DEFAULT 0,
  days_between_orders numeric,
  dominant_category text,
  top_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  chronic_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_insight text,
  ai_insight_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.customer_profiles TO authenticated;
GRANT ALL ON public.customer_profiles TO service_role;
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read customer_profiles" ON public.customer_profiles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'orders'));

CREATE TABLE IF NOT EXISTS public.customer_scores (
  phone text PRIMARY KEY REFERENCES public.customer_profiles(phone) ON DELETE CASCADE,
  health_score int NOT NULL DEFAULT 50,
  value_score int NOT NULL DEFAULT 0,
  risk_score int NOT NULL DEFAULT 0,
  segment text NOT NULL DEFAULT 'new',
  computed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_scores_segment_idx ON public.customer_scores(segment);
CREATE INDEX IF NOT EXISTS customer_scores_value_idx ON public.customer_scores(value_score DESC);
GRANT SELECT ON public.customer_scores TO authenticated;
GRANT ALL ON public.customer_scores TO service_role;
ALTER TABLE public.customer_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read customer_scores" ON public.customer_scores
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'orders'));

CREATE TABLE IF NOT EXISTS public.agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent text NOT NULL,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'ok',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  summary text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  impact_estimate numeric,
  confidence int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_runs_created_idx ON public.agent_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS agent_runs_agent_idx ON public.agent_runs(agent, created_at DESC);
GRANT SELECT ON public.agent_runs TO authenticated;
GRANT ALL ON public.agent_runs TO service_role;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read agent_runs" ON public.agent_runs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'orders'));

CREATE TABLE IF NOT EXISTS public.marketing_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_kind text NOT NULL,
  customer_phone text NOT NULL,
  customer_name text,
  segment text,
  reason text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  message_text text,
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid,
  approved_at timestamptz,
  sent_at timestamptz,
  wamid text,
  error text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketing_queue_status_chk CHECK (status IN ('pending','approved','sent','skipped','failed'))
);
CREATE INDEX IF NOT EXISTS marketing_queue_status_idx ON public.marketing_queue(status, generated_at DESC);
CREATE INDEX IF NOT EXISTS marketing_queue_kind_phone_idx ON public.marketing_queue(campaign_kind, customer_phone, generated_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.marketing_queue TO authenticated;
GRANT ALL ON public.marketing_queue TO service_role;
ALTER TABLE public.marketing_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage marketing_queue" ON public.marketing_queue
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'orders'))
  WITH CHECK (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'orders'));

CREATE TABLE IF NOT EXISTS public.executive_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.executive_reports TO authenticated;
GRANT ALL ON public.executive_reports TO service_role;
ALTER TABLE public.executive_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read executive_reports" ON public.executive_reports
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS orders_phone_created_idx ON public.orders(customer_phone, created_at DESC);

-- ============================================================
CREATE OR REPLACE FUNCTION public._intel_can_manage()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(),'owner')
    OR public.has_role(auth.uid(),'admin')
    OR public.has_permission(auth.uid(),'orders')
  );
$$;

-- ============================================================
CREATE OR REPLACE FUNCTION public.rebuild_customer_intel()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_profiles int := 0;
  v_scores int := 0;
  v_q_dormant int := 0;
  v_q_refill int := 0;
  v_q_declining int := 0;
  v_run_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.agent_runs(id, agent, kind, status, summary)
    VALUES (v_run_id, 'intel.nightly', 'rebuild', 'running', 'بدء إعادة بناء ملفات العملاء');

  WITH per_phone AS (
    SELECT
      o.customer_phone AS phone,
      max(o.customer_name) AS name,
      min(o.created_at) AS first_seen,
      max(o.created_at) FILTER (WHERE o.status <> 'cancelled') AS last_order_at,
      count(*) FILTER (WHERE o.status <> 'cancelled') AS orders_count,
      count(*) FILTER (WHERE o.status = 'cancelled') AS cancelled_count,
      coalesce(sum(o.total) FILTER (WHERE o.status <> 'cancelled'), 0) AS total_spent
    FROM public.orders o
    WHERE o.customer_phone IS NOT NULL AND length(trim(o.customer_phone)) > 0
    GROUP BY o.customer_phone
  ),
  upserted AS (
    INSERT INTO public.customer_profiles AS cp (
      phone, name, first_seen, last_order_at, orders_count, cancelled_count,
      total_spent, avg_order_value, days_between_orders, updated_at
    )
    SELECT
      pp.phone, pp.name, pp.first_seen, pp.last_order_at,
      pp.orders_count, pp.cancelled_count, pp.total_spent,
      CASE WHEN pp.orders_count > 0 THEN round(pp.total_spent / pp.orders_count, 2) ELSE 0 END,
      CASE
        WHEN pp.orders_count >= 2 AND pp.last_order_at IS NOT NULL THEN
          round(extract(epoch FROM (pp.last_order_at - pp.first_seen)) / 86400.0 / (pp.orders_count - 1), 1)
        ELSE NULL
      END,
      now()
    FROM per_phone pp
    ON CONFLICT (phone) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, cp.name),
      last_order_at = EXCLUDED.last_order_at,
      orders_count = EXCLUDED.orders_count,
      cancelled_count = EXCLUDED.cancelled_count,
      total_spent = EXCLUDED.total_spent,
      avg_order_value = EXCLUDED.avg_order_value,
      days_between_orders = EXCLUDED.days_between_orders,
      updated_at = now()
    RETURNING 1
  )
  SELECT count(*) INTO v_profiles FROM upserted;

  WITH item_cats AS (
    SELECT o.customer_phone AS phone,
           pc.therapeutic_category::text AS cat,
           coalesce(pc.is_chronic, false) AS chronic,
           (it->>'qty')::int AS qty
    FROM public.orders o,
         jsonb_array_elements(o.items) it
    LEFT JOIN public.product_classifications pc
      ON pc.product_legacy_id = (it->>'id')::int AND pc.status = 'approved'
    WHERE o.status <> 'cancelled' AND o.customer_phone IS NOT NULL
      AND pc.therapeutic_category IS NOT NULL
  ),
  agg AS (
    SELECT phone, cat, sum(qty) AS units, bool_or(chronic) AS is_chronic
    FROM item_cats GROUP BY phone, cat
  ),
  top_cat AS (
    SELECT DISTINCT ON (phone) phone, cat
    FROM agg ORDER BY phone, units DESC
  ),
  chronic_per_phone AS (
    SELECT phone, jsonb_object_agg(cat, true) FILTER (WHERE is_chronic) AS flags
    FROM agg GROUP BY phone
  ),
  top_n AS (
    SELECT phone, jsonb_agg(jsonb_build_object('cat', cat, 'units', units) ORDER BY units DESC) AS top
    FROM agg GROUP BY phone
  )
  UPDATE public.customer_profiles cp SET
    dominant_category = tc.cat,
    chronic_flags = COALESCE(cf.flags, '{}'::jsonb),
    top_categories = COALESCE(tn.top, '[]'::jsonb),
    updated_at = now()
  FROM top_cat tc
  LEFT JOIN chronic_per_phone cf ON cf.phone = tc.phone
  LEFT JOIN top_n tn ON tn.phone = tc.phone
  WHERE cp.phone = tc.phone;

  WITH base AS (
    SELECT
      cp.phone, cp.orders_count, cp.total_spent, cp.avg_order_value, cp.last_order_at,
      cp.chronic_flags <> '{}'::jsonb AS is_chronic,
      EXTRACT(epoch FROM (now() - COALESCE(cp.last_order_at, cp.first_seen))) / 86400.0 AS days_since,
      cp.days_between_orders
    FROM public.customer_profiles cp
  ),
  stats AS (
    SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY total_spent) AS p90_spent FROM base
  ),
  scored AS (
    SELECT
      b.phone,
      LEAST(100, GREATEST(0, round(
        (CASE WHEN s.p90_spent > 0 THEN (b.total_spent / s.p90_spent) * 100 ELSE 0 END)
      )::int))::int AS value_score,
      LEAST(100, GREATEST(0, round(
        CASE
          WHEN b.orders_count = 0 THEN 50
          WHEN b.days_between_orders IS NULL THEN LEAST(80, b.days_since)::int
          ELSE LEAST(100, (b.days_since / GREATEST(b.days_between_orders, 7)) * 50)::int
        END
      )::int))::int AS risk_score,
      LEAST(100, GREATEST(0, round(
        100
        - LEAST(60, b.days_since::int / 2)
        + LEAST(20, b.orders_count * 2)
        + CASE WHEN b.is_chronic THEN 10 ELSE 0 END
      )::int))::int AS health_score,
      b.orders_count, b.is_chronic, b.days_since
    FROM base b CROSS JOIN stats s
  ),
  with_segment AS (
    SELECT
      phone, health_score, value_score, risk_score,
      CASE
        WHEN orders_count = 0 THEN 'new'
        WHEN value_score >= 80 THEN 'vip'
        WHEN is_chronic AND days_since <= 60 THEN 'chronic'
        WHEN days_since > 90 THEN 'dormant'
        WHEN days_since > 45 THEN 'declining'
        ELSE 'active'
      END AS segment
    FROM scored
  ),
  upserted AS (
    INSERT INTO public.customer_scores AS cs (phone, health_score, value_score, risk_score, segment, computed_at)
    SELECT phone, health_score, value_score, risk_score, segment, now() FROM with_segment
    ON CONFLICT (phone) DO UPDATE SET
      health_score = EXCLUDED.health_score,
      value_score = EXCLUDED.value_score,
      risk_score = EXCLUDED.risk_score,
      segment = EXCLUDED.segment,
      computed_at = now()
    RETURNING 1
  )
  SELECT count(*) INTO v_scores FROM upserted;

  -- queue: dormant (no same-kind row for this phone today)
  INSERT INTO public.marketing_queue(campaign_kind, customer_phone, customer_name, segment, reason, payload, message_text)
  SELECT 'dormant', cs.phone, cp.name, cs.segment,
         'لم يطلب منذ ' || round(EXTRACT(epoch FROM (now() - cp.last_order_at))/86400)::text || ' يوم',
         jsonb_build_object('days_since', round(EXTRACT(epoch FROM (now() - cp.last_order_at))/86400),
                            'value_score', cs.value_score),
         'مرحباً ' || COALESCE(cp.name,'') || '، اشتقنا لك في صيدلية المصلي. تفضل بزيارة منتجاتنا الجديدة.'
  FROM public.customer_scores cs
  JOIN public.customer_profiles cp ON cp.phone = cs.phone
  WHERE cs.segment = 'dormant' AND cp.orders_count >= 1 AND cs.value_score >= 10
    AND NOT EXISTS (
      SELECT 1 FROM public.marketing_queue mq
      WHERE mq.campaign_kind='dormant' AND mq.customer_phone=cs.phone
        AND mq.generated_at > now() - interval '7 days'
    );
  GET DIAGNOSTICS v_q_dormant = ROW_COUNT;

  INSERT INTO public.marketing_queue(campaign_kind, customer_phone, customer_name, segment, reason, payload, message_text)
  SELECT 'refill_due', cs.phone, cp.name, cs.segment,
         'دواء مزمن — وقت إعادة الصرف',
         jsonb_build_object('chronic_flags', cp.chronic_flags,
                            'days_since', round(EXTRACT(epoch FROM (now() - cp.last_order_at))/86400)),
         'تذكير لطيف: حان موعد إعادة صرف دوائك الشهري. تواصل معنا للطلب.'
  FROM public.customer_scores cs
  JOIN public.customer_profiles cp ON cp.phone = cs.phone
  WHERE cp.chronic_flags <> '{}'::jsonb
    AND cp.last_order_at IS NOT NULL
    AND cp.last_order_at < now() - interval '22 days'
    AND cp.last_order_at > now() - interval '50 days'
    AND NOT EXISTS (
      SELECT 1 FROM public.marketing_queue mq
      WHERE mq.campaign_kind='refill_due' AND mq.customer_phone=cs.phone
        AND mq.generated_at > now() - interval '14 days'
    );
  GET DIAGNOSTICS v_q_refill = ROW_COUNT;

  INSERT INTO public.marketing_queue(campaign_kind, customer_phone, customer_name, segment, reason, payload, message_text)
  SELECT 'declining', cs.phone, cp.name, cs.segment,
         'عميل بدأ يتراجع — قبل أن نخسره',
         jsonb_build_object('value_score', cs.value_score, 'risk_score', cs.risk_score),
         'عرض خاص لك: خصم 10% على طلبك القادم باستخدام كود WELCOMEBACK10'
  FROM public.customer_scores cs
  JOIN public.customer_profiles cp ON cp.phone = cs.phone
  WHERE cs.segment = 'declining' AND cs.value_score >= 25
    AND NOT EXISTS (
      SELECT 1 FROM public.marketing_queue mq
      WHERE mq.campaign_kind='declining' AND mq.customer_phone=cs.phone
        AND mq.generated_at > now() - interval '14 days'
    );
  GET DIAGNOSTICS v_q_declining = ROW_COUNT;

  UPDATE public.agent_runs
  SET status='ok', finished_at=now(),
      summary='تم بناء ' || v_profiles || ' ملف عميل و' || v_scores || ' درجة، وقائمة تسويق جديدة',
      details = jsonb_build_object('profiles', v_profiles, 'scores', v_scores,
                                   'queue_dormant', v_q_dormant,
                                   'queue_refill', v_q_refill,
                                   'queue_declining', v_q_declining)
  WHERE id = v_run_id;

  RETURN jsonb_build_object(
    'ok', true, 'profiles', v_profiles, 'scores', v_scores,
    'queue_dormant', v_q_dormant, 'queue_refill', v_q_refill, 'queue_declining', v_q_declining,
    'run_id', v_run_id
  );
END $$;

-- ============================================================
CREATE OR REPLACE FUNCTION public.exec_dashboard()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Aden')::date;
  v_mstart timestamptz := date_trunc('month', now() AT TIME ZONE 'Asia/Aden');
  v_rev_today numeric; v_rev_month numeric;
  v_orders_today int; v_orders_month int;
  v_repeat_count int; v_total_customers int; v_chronic int;
  v_segments jsonb; v_top_diseases jsonb; v_top_classes jsonb; v_top_bundles jsonb;
  v_low_stock int; v_oos int; v_lost numeric; v_recovered numeric; v_queue jsonb;
BEGIN
  IF NOT public._intel_can_manage() THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT coalesce(sum(total) FILTER (WHERE status<>'cancelled'),0), count(*)
    INTO v_rev_today, v_orders_today
    FROM public.orders
    WHERE (created_at AT TIME ZONE 'Asia/Aden')::date = v_today;

  SELECT coalesce(sum(total) FILTER (WHERE status<>'cancelled'),0), count(*)
    INTO v_rev_month, v_orders_month
    FROM public.orders WHERE created_at >= v_mstart;

  SELECT count(*) FILTER (WHERE orders_count >= 2), count(*)
    INTO v_repeat_count, v_total_customers
    FROM public.customer_profiles;

  SELECT count(*) INTO v_chronic FROM public.customer_profiles WHERE chronic_flags <> '{}'::jsonb;

  SELECT coalesce(jsonb_object_agg(segment, n), '{}'::jsonb) INTO v_segments
    FROM (SELECT segment, count(*) AS n FROM public.customer_scores GROUP BY segment) s;

  SELECT coalesce(jsonb_agg(jsonb_build_object('cat', cat, 'units', units, 'revenue', rev) ORDER BY units DESC), '[]'::jsonb)
  INTO v_top_diseases FROM (
    SELECT pc.therapeutic_category::text AS cat,
           sum((it->>'qty')::int) AS units,
           sum((it->>'qty')::int * (it->>'price')::numeric) AS rev
    FROM public.orders o, jsonb_array_elements(o.items) it
    JOIN public.product_classifications pc ON pc.product_legacy_id = (it->>'id')::int AND pc.status='approved'
    WHERE o.created_at >= now() - interval '30 days' AND o.status <> 'cancelled'
    GROUP BY pc.therapeutic_category ORDER BY units DESC LIMIT 8
  ) t;

  SELECT coalesce(jsonb_agg(jsonb_build_object('class', class, 'units', units) ORDER BY units DESC), '[]'::jsonb)
  INTO v_top_classes FROM (
    SELECT pc.pharmacological_class AS class, sum((it->>'qty')::int) AS units
    FROM public.orders o, jsonb_array_elements(o.items) it
    JOIN public.product_classifications pc ON pc.product_legacy_id = (it->>'id')::int AND pc.status='approved'
    WHERE o.created_at >= now() - interval '30 days' AND o.status<>'cancelled'
      AND pc.pharmacological_class IS NOT NULL
    GROUP BY pc.pharmacological_class ORDER BY units DESC LIMIT 6
  ) t;

  SELECT coalesce(jsonb_agg(jsonb_build_object('name', name, 'sales', sales_count, 'revenue', revenue) ORDER BY revenue DESC NULLS LAST), '[]'::jsonb)
  INTO v_top_bundles FROM (
    SELECT name, sales_count, revenue FROM public.bundles
    WHERE is_active ORDER BY revenue DESC NULLS LAST LIMIT 5
  ) b;

  SELECT count(*) FILTER (WHERE track_stock AND stock_qty <= reorder_point),
         count(*) FILTER (WHERE track_stock AND stock_qty = 0)
    INTO v_low_stock, v_oos FROM public.products;

  SELECT coalesce(sum(total),0) INTO v_lost
    FROM public.orders WHERE status='cancelled' AND created_at >= now() - interval '30 days';

  SELECT coalesce(sum(o.total),0) INTO v_recovered
    FROM public.orders o
    JOIN public.marketing_queue mq ON mq.customer_phone = o.customer_phone
      AND mq.status='sent' AND mq.sent_at < o.created_at
      AND o.created_at < mq.sent_at + interval '7 days'
    WHERE o.status<>'cancelled' AND o.created_at >= now() - interval '30 days';

  SELECT jsonb_build_object(
    'pending', count(*) FILTER (WHERE status='pending'),
    'approved', count(*) FILTER (WHERE status='approved'),
    'sent_today', count(*) FILTER (WHERE status='sent' AND sent_at::date = current_date)
  ) INTO v_queue FROM public.marketing_queue;

  RETURN jsonb_build_object(
    'revenue_today', v_rev_today,
    'revenue_month', v_rev_month,
    'orders_today', v_orders_today,
    'orders_month', v_orders_month,
    'total_customers', v_total_customers,
    'repeat_customers', v_repeat_count,
    'repeat_rate', CASE WHEN v_total_customers > 0 THEN round((v_repeat_count::numeric / v_total_customers) * 100, 1) ELSE 0 END,
    'chronic_patients', v_chronic,
    'segments', v_segments,
    'top_diseases', v_top_diseases,
    'top_classes', v_top_classes,
    'top_bundles', v_top_bundles,
    'inventory_low_stock', v_low_stock,
    'inventory_oos', v_oos,
    'lost_revenue_30d', v_lost,
    'recovered_revenue_30d', v_recovered,
    'marketing_queue', v_queue,
    'generated_at', now()
  );
END $$;

-- ============================================================
CREATE OR REPLACE FUNCTION public.marketing_queue_list(_status text DEFAULT NULL, _limit int DEFAULT 200)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public._intel_can_manage() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id, 'campaign_kind', q.campaign_kind, 'customer_phone', q.customer_phone,
    'customer_name', q.customer_name, 'segment', q.segment, 'reason', q.reason,
    'payload', q.payload, 'message_text', q.message_text, 'status', q.status,
    'approved_at', q.approved_at, 'sent_at', q.sent_at, 'wamid', q.wamid, 'error', q.error,
    'generated_at', q.generated_at,
    'value_score', cs.value_score, 'health_score', cs.health_score, 'risk_score', cs.risk_score
  ) ORDER BY q.generated_at DESC), '[]'::jsonb) INTO v
  FROM (
    SELECT * FROM public.marketing_queue
    WHERE (_status IS NULL OR status = _status)
    ORDER BY generated_at DESC
    LIMIT GREATEST(1, LEAST(_limit, 500))
  ) q
  LEFT JOIN public.customer_scores cs ON cs.phone = q.customer_phone;
  RETURN coalesce(v, '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.marketing_queue_approve(_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public._intel_can_manage() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.marketing_queue
    SET status='approved', approved_by=auth.uid(), approved_at=now()
    WHERE id=_id AND status='pending';
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.marketing_queue_skip(_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public._intel_can_manage() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.marketing_queue
    SET status='skipped', approved_by=auth.uid(), approved_at=now()
    WHERE id=_id AND status IN ('pending','approved');
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.marketing_queue_mark_sent(_id uuid, _wamid text DEFAULT NULL, _error text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public._intel_can_manage() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.marketing_queue
    SET status = CASE WHEN _error IS NULL THEN 'sent' ELSE 'failed' END,
        sent_at = CASE WHEN _error IS NULL THEN now() ELSE sent_at END,
        wamid = _wamid, error = _error
    WHERE id=_id;
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.agent_runs_list(_limit int DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public._intel_can_manage() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'agent', agent, 'kind', kind, 'status', status,
    'started_at', started_at, 'finished_at', finished_at,
    'summary', summary, 'details', details,
    'impact_estimate', impact_estimate, 'confidence', confidence
  ) ORDER BY started_at DESC), '[]'::jsonb) INTO v
  FROM (SELECT * FROM public.agent_runs ORDER BY started_at DESC LIMIT GREATEST(1, LEAST(_limit, 500))) ar;
  RETURN coalesce(v, '[]'::jsonb);
END $$;

-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$ BEGIN PERFORM cron.unschedule('muslly-nightly-intel'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'muslly-nightly-intel',
  '30 23 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--4d4aad01-9bf4-4d8b-acab-e51a06a17c63.lovable.app/api/public/hooks/nightly-intel',
    headers := jsonb_build_object('Content-Type','application/json','apikey','sb_publishable_t5XgSgu8VR1zrm4DTF5_lQ__FE985_7'),
    body := '{}'::jsonb
  );
  $cron$
);
