
CREATE OR REPLACE FUNCTION public.declining_products()
RETURNS TABLE(legacy_id int, name text, revenue_this numeric, revenue_prev numeric,
  drop_pct numeric, units_this int, units_prev int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  WITH ev AS (
    SELECT (it->>'id')::int AS legacy_id, coalesce((it->>'qty')::int,1) AS qty,
      coalesce((it->>'price')::numeric,0) AS price, o.created_at
    FROM public.orders o, jsonb_array_elements(o.items) it
    WHERE o.status NOT IN ('cancelled','draft','refunded')
      AND jsonb_typeof(o.items) = 'array'
      AND o.created_at >= now() - interval '14 days'
  ),
  agg AS (
    SELECT ev.legacy_id,
      sum(qty*price) FILTER (WHERE created_at >= now()-interval '7 days') AS rev_this,
      sum(qty*price) FILTER (WHERE created_at <  now()-interval '7 days') AS rev_prev,
      sum(qty) FILTER (WHERE created_at >= now()-interval '7 days') AS u_this,
      sum(qty) FILTER (WHERE created_at <  now()-interval '7 days') AS u_prev
    FROM ev GROUP BY ev.legacy_id
  )
  SELECT a.legacy_id, p.name, coalesce(rev_this,0)::numeric, coalesce(rev_prev,0)::numeric,
    CASE WHEN coalesce(rev_prev,0) > 0
      THEN round(((rev_this - rev_prev)/rev_prev * 100)::numeric, 1) ELSE NULL END,
    coalesce(u_this,0)::int, coalesce(u_prev,0)::int
  FROM agg a JOIN public.products p ON p.legacy_id = a.legacy_id
  WHERE coalesce(rev_prev,0) > 0 AND coalesce(rev_this,0) < coalesce(rev_prev,0) * 0.7
  ORDER BY (rev_prev - rev_this) DESC LIMIT 20;
END $$;
REVOKE ALL ON FUNCTION public.declining_products() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.declining_products() TO authenticated;

CREATE OR REPLACE FUNCTION public.chronic_overdue(_grace numeric DEFAULT 1.5)
RETURNS TABLE(phone text, name text, last_order_at timestamptz, days_since int,
  days_between numeric, chronic_flags jsonb, dominant_category text, total_spent numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT cp.phone, cp.name, cp.last_order_at,
    extract(day from (now() - cp.last_order_at))::int,
    cp.days_between_orders, cp.chronic_flags, cp.dominant_category, cp.total_spent
  FROM public.customer_profiles cp
  WHERE cp.chronic_flags IS NOT NULL
    AND jsonb_typeof(cp.chronic_flags) = 'array'
    AND jsonb_array_length(cp.chronic_flags) > 0
    AND cp.last_order_at IS NOT NULL
    AND cp.days_between_orders IS NOT NULL
    AND cp.days_between_orders > 0
    AND (now() - cp.last_order_at) > make_interval(days => (cp.days_between_orders * _grace)::int)
  ORDER BY cp.total_spent DESC NULLS LAST LIMIT 100;
END $$;
REVOKE ALL ON FUNCTION public.chronic_overdue(numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chronic_overdue(numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_chronic_refills(_discount_pct int DEFAULT 15, _limit int DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inserted int := 0; v_code text; r record;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'forbidden'; END IF;
  v_code := 'CHRONIC' || _discount_pct;
  INSERT INTO public.discount_codes(code, kind, value, active)
    VALUES (v_code, 'percent', _discount_pct, true)
    ON CONFLICT (code) DO NOTHING;
  FOR r IN SELECT * FROM public.chronic_overdue(1.5) LIMIT _limit LOOP
    IF EXISTS (SELECT 1 FROM public.marketing_queue mq
      WHERE mq.customer_phone = r.phone AND mq.campaign_kind = 'chronic_refill'
        AND mq.generated_at > now() - interval '14 days') THEN CONTINUE; END IF;
    INSERT INTO public.marketing_queue(campaign_kind, customer_phone, customer_name, segment, reason,
      payload, message_text, status, generated_at)
    VALUES ('chronic_refill', r.phone, r.name,
      coalesce(r.dominant_category,'chronic'),
      format('overdue %s days (interval %s)', r.days_since, round(r.days_between,0)),
      jsonb_build_object('chronic_flags', r.chronic_flags, 'discount_code', v_code,
        'discount_pct', _discount_pct, 'last_order_at', r.last_order_at),
      format(E'مرحباً %s 👋\nنُذكّرك بموعد إعادة دوائك المزمن من صيدلية المصلي.\nاستخدم كود %s للحصول على خصم %s%% على طلبك.\nاطلب الآن عبر https://muslly.com 💊',
        coalesce(r.name,'عميلنا الكريم'), v_code, _discount_pct),
      'pending', now());
    v_inserted := v_inserted + 1;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'enqueued', v_inserted, 'discount_code', v_code);
END $$;
REVOKE ALL ON FUNCTION public.enqueue_chronic_refills(int,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_chronic_refills(int,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.auto_bundle_candidates(_days int DEFAULT 90)
RETURNS TABLE(a_id int, a_name text, b_id int, b_name text, co_count int,
  lift numeric, avg_combined_price numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  WITH oi AS (
    SELECT DISTINCT o.id AS order_id, (it->>'id')::int AS legacy_id,
      coalesce((it->>'price')::numeric,0) AS price
    FROM public.orders o, jsonb_array_elements(o.items) it
    WHERE o.created_at >= now() - make_interval(days => _days)
      AND o.status NOT IN ('cancelled','draft','refunded')
      AND jsonb_typeof(o.items) = 'array'
  ),
  totals AS (SELECT count(DISTINCT order_id)::numeric AS n FROM oi),
  freq AS (SELECT oi.legacy_id, count(DISTINCT order_id)::numeric AS f FROM oi GROUP BY oi.legacy_id),
  pairs AS (
    SELECT a.legacy_id AS aid, b.legacy_id AS bid, count(*)::int AS co,
      avg(a.price + b.price)::numeric AS avg_price
    FROM oi a JOIN oi b ON a.order_id = b.order_id AND a.legacy_id < b.legacy_id
    GROUP BY a.legacy_id, b.legacy_id HAVING count(*) >= 3
  )
  SELECT p.aid, pa.name, p.bid, pb.name, p.co,
    round(((p.co::numeric / t.n) / ((fa.f/t.n) * (fb.f/t.n)))::numeric, 2),
    round(p.avg_price, 0)
  FROM pairs p CROSS JOIN totals t
  JOIN freq fa ON fa.legacy_id = p.aid
  JOIN freq fb ON fb.legacy_id = p.bid
  JOIN public.products pa ON pa.legacy_id = p.aid
  JOIN public.products pb ON pb.legacy_id = p.bid
  WHERE t.n > 5
  ORDER BY ((p.co::numeric / t.n) / ((fa.f/t.n) * (fb.f/t.n))) DESC, p.co DESC LIMIT 30;
END $$;
REVOKE ALL ON FUNCTION public.auto_bundle_candidates(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_bundle_candidates(int) TO authenticated;
