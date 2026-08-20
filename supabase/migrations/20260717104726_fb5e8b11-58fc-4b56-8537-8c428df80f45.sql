-- ============================================================
-- PHOENIX PHASE 6A — Inventory Intelligence Core
-- ============================================================

-- 1) Health scores per product
CREATE TABLE public.inventory_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy','warning','critical','dead')),
  availability_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  velocity_daily NUMERIC(10,3) NOT NULL DEFAULT 0,
  expiry_risk NUMERIC(5,2) NOT NULL DEFAULT 0,
  days_of_cover NUMERIC(8,2),
  current_qty INTEGER NOT NULL DEFAULT 0,
  recommendation TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id)
);
CREATE INDEX idx_health_scores_status ON public.inventory_health_scores (status, score);
GRANT SELECT ON public.inventory_health_scores TO authenticated;
GRANT ALL ON public.inventory_health_scores TO service_role;
ALTER TABLE public.inventory_health_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read health scores"
  ON public.inventory_health_scores FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- 2) Demand forecasts
CREATE TABLE public.demand_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  horizon_days INTEGER NOT NULL CHECK (horizon_days IN (7,30)),
  expected_units NUMERIC(12,2) NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'moving_avg',
  confidence NUMERIC(5,2) NOT NULL DEFAULT 50,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, horizon_days)
);
GRANT SELECT ON public.demand_forecasts TO authenticated;
GRANT ALL ON public.demand_forecasts TO service_role;
ALTER TABLE public.demand_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read forecasts"
  ON public.demand_forecasts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- 3) Purchase recommendations
CREATE TABLE public.purchase_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  recommended_qty INTEGER NOT NULL,
  reason TEXT NOT NULL,
  urgency TEXT NOT NULL CHECK (urgency IN ('low','medium','high','critical','dead_stock')),
  preferred_supplier_id UUID REFERENCES public.sup_suppliers(id) ON DELETE SET NULL,
  expected_stockout_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','approved','dismissed','ordered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX idx_purchase_recs_open ON public.purchase_recommendations (status, urgency, created_at DESC) WHERE status = 'open';
GRANT SELECT ON public.purchase_recommendations TO authenticated;
GRANT ALL ON public.purchase_recommendations TO service_role;
ALTER TABLE public.purchase_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read recommendations"
  ON public.purchase_recommendations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- 4) Emit agent_events when a new recommendation lands
CREATE OR REPLACE FUNCTION public.emit_purchase_recommendation_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.agent_events (event_name, entity_type, entity_id, payload, source, occurred_at)
  VALUES (
    'PURCHASE_RECOMMENDED',
    'purchase_recommendation',
    NEW.id,
    jsonb_build_object(
      'product_id', NEW.product_id,
      'recommended_qty', NEW.recommended_qty,
      'urgency', NEW.urgency,
      'reason', NEW.reason
    ),
    'inv_intel_snapshot',
    now()
  );
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.emit_purchase_recommendation_event() FROM PUBLIC;

CREATE TRIGGER trg_emit_purchase_recommendation
AFTER INSERT ON public.purchase_recommendations
FOR EACH ROW EXECUTE FUNCTION public.emit_purchase_recommendation_event();

-- 5) The intelligence snapshot RPC
CREATE OR REPLACE FUNCTION public.inv_intel_snapshot()
RETURNS TABLE (
  products_scored INTEGER,
  recommendations_created INTEGER
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_scored INTEGER := 0;
  v_recs INTEGER := 0;
  r RECORD;
  v_velocity NUMERIC;
  v_days_cover NUMERIC;
  v_availability NUMERIC;
  v_expiry_risk NUMERIC;
  v_margin_signal NUMERIC;
  v_velocity_signal NUMERIC;
  v_score NUMERIC;
  v_status TEXT;
  v_urgency TEXT;
  v_recommended_qty INTEGER;
  v_reason TEXT;
  v_expected_stockout TIMESTAMPTZ;
BEGIN
  FOR r IN
    SELECT
      p.id,
      p.legacy_id,
      p.name,
      p.stock_qty,
      p.reorder_point,
      p.reorder_threshold,
      p.price,
      p.supplier_cost,
      p.expiry_date,
      p.track_stock
    FROM public.products p
    WHERE p.is_active = true AND p.is_published = true
  LOOP
    -- Velocity: qty sold in last 30 days from orders.items jsonb
    SELECT COALESCE(SUM((item->>'qty')::numeric), 0) / 30.0
      INTO v_velocity
      FROM public.orders o,
           LATERAL jsonb_array_elements(o.items) AS item
      WHERE o.created_at >= now() - INTERVAL '30 days'
        AND o.status NOT IN ('cancelled','failed')
        AND (item->>'id')::text = r.legacy_id::text;

    v_velocity := COALESCE(v_velocity, 0);

    -- Days of cover
    v_days_cover := CASE WHEN v_velocity > 0 THEN r.stock_qty / v_velocity ELSE NULL END;

    -- Availability vs threshold
    v_availability := LEAST(1.0, r.stock_qty::numeric / NULLIF(GREATEST(r.reorder_threshold, 1), 0));

    -- Expiry risk: 1.0 if expiry within 90d, else 0
    v_expiry_risk := CASE
      WHEN r.expiry_date IS NOT NULL AND r.expiry_date <= (CURRENT_DATE + INTERVAL '90 days') THEN 1.0
      WHEN r.expiry_date IS NOT NULL AND r.expiry_date <= (CURRENT_DATE + INTERVAL '180 days') THEN 0.5
      ELSE 0.0
    END;

    -- Margin signal
    v_margin_signal := CASE
      WHEN r.supplier_cost IS NOT NULL AND r.price > 0
        THEN LEAST(1.0, GREATEST(0.0, (r.price - r.supplier_cost) / r.price))
      ELSE 0.5
    END;

    v_velocity_signal := CASE
      WHEN v_days_cover IS NULL THEN 0.3
      ELSE LEAST(1.0, GREATEST(0.0, v_days_cover / 14.0))
    END;

    -- Composite score 0..100
    v_score := 100 * (
      0.35 * v_availability
      + 0.25 * (1 - v_expiry_risk)
      + 0.25 * v_velocity_signal
      + 0.15 * v_margin_signal
    );

    v_status := CASE
      WHEN v_expiry_risk >= 1.0 AND v_velocity < (1.0/7.0) THEN 'dead'
      WHEN v_score < 40 OR (v_days_cover IS NOT NULL AND v_days_cover < 3) THEN 'critical'
      WHEN v_score < 60 OR (v_days_cover IS NOT NULL AND v_days_cover < 7) THEN 'warning'
      ELSE 'healthy'
    END;

    -- Upsert health score
    INSERT INTO public.inventory_health_scores (
      product_id, score, status, availability_pct, velocity_daily,
      expiry_risk, days_of_cover, current_qty, recommendation, computed_at
    ) VALUES (
      r.id,
      ROUND(v_score, 2),
      v_status,
      ROUND(v_availability * 100, 2),
      ROUND(v_velocity, 3),
      ROUND(v_expiry_risk * 100, 2),
      CASE WHEN v_days_cover IS NULL THEN NULL ELSE ROUND(v_days_cover, 2) END,
      r.stock_qty,
      CASE v_status
        WHEN 'dead' then 'مخزون راكد قرب الانتهاء — اعرض تخفيضاً'
        WHEN 'critical' then 'شراء عاجل مطلوب'
        WHEN 'warning' then 'مراقبة — قد يحتاج تعزيز خلال أسبوع'
        ELSE 'المخزون بحالة جيدة'
      END,
      now()
    )
    ON CONFLICT (product_id) DO UPDATE SET
      score = EXCLUDED.score,
      status = EXCLUDED.status,
      availability_pct = EXCLUDED.availability_pct,
      velocity_daily = EXCLUDED.velocity_daily,
      expiry_risk = EXCLUDED.expiry_risk,
      days_of_cover = EXCLUDED.days_of_cover,
      current_qty = EXCLUDED.current_qty,
      recommendation = EXCLUDED.recommendation,
      computed_at = EXCLUDED.computed_at;

    -- Forecasts (moving average)
    INSERT INTO public.demand_forecasts (product_id, horizon_days, expected_units, method, confidence, computed_at)
    VALUES (r.id, 7, ROUND(v_velocity * 7, 2), 'moving_avg', 65, now())
    ON CONFLICT (product_id, horizon_days) DO UPDATE SET
      expected_units = EXCLUDED.expected_units, computed_at = EXCLUDED.computed_at;

    INSERT INTO public.demand_forecasts (product_id, horizon_days, expected_units, method, confidence, computed_at)
    VALUES (r.id, 30, ROUND(v_velocity * 30, 2), 'moving_avg', 55, now())
    ON CONFLICT (product_id, horizon_days) DO UPDATE SET
      expected_units = EXCLUDED.expected_units, computed_at = EXCLUDED.computed_at;

    v_scored := v_scored + 1;

    -- Recommendation logic
    IF v_status IN ('critical','warning') AND v_velocity > 0
       AND NOT EXISTS (
         SELECT 1 FROM public.purchase_recommendations pr
         WHERE pr.product_id = r.id AND pr.status = 'open'
       ) THEN

      v_urgency := CASE
        WHEN v_days_cover IS NOT NULL AND v_days_cover < 3 THEN 'critical'
        WHEN v_days_cover IS NOT NULL AND v_days_cover < 7 THEN 'high'
        ELSE 'medium'
      END;

      v_recommended_qty := GREATEST(
        r.reorder_threshold * 2,
        CEIL(v_velocity * 30)::INTEGER
      );

      v_expected_stockout := CASE
        WHEN v_days_cover IS NOT NULL THEN now() + (v_days_cover || ' days')::INTERVAL
        ELSE NULL
      END;

      v_reason := format(
        'المخزون الحالي %s وحدة، معدل البيع %.2f/يوم، أيام التغطية %s',
        r.stock_qty,
        v_velocity,
        COALESCE(ROUND(v_days_cover, 1)::TEXT, 'غير معروف')
      );

      INSERT INTO public.purchase_recommendations (
        product_id, recommended_qty, reason, urgency, expected_stockout_at
      ) VALUES (
        r.id, v_recommended_qty, v_reason, v_urgency, v_expected_stockout
      );

      v_recs := v_recs + 1;

    ELSIF v_status = 'dead'
       AND NOT EXISTS (
         SELECT 1 FROM public.purchase_recommendations pr
         WHERE pr.product_id = r.id AND pr.status = 'open'
       ) THEN

      INSERT INTO public.purchase_recommendations (
        product_id, recommended_qty, reason, urgency
      ) VALUES (
        r.id, 0,
        format('مخزون راكد: %s وحدة، بيع بطيء وقرب انتهاء', r.stock_qty),
        'dead_stock'
      );
      v_recs := v_recs + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_scored, v_recs;
END; $$;
REVOKE ALL ON FUNCTION public.inv_intel_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inv_intel_snapshot() TO service_role;

-- 6) Schedule every 6 hours
SELECT cron.schedule(
  'inventory-intelligence-snapshot',
  '0 */6 * * *',
  $c$ SELECT public.inv_intel_snapshot(); $c$
);

-- 7) Add PURCHASE_RECOMMENDED to inventory agent subscriptions
UPDATE public.ai_agents
SET event_subscriptions = array_append(event_subscriptions, 'PURCHASE_RECOMMENDED')
WHERE code = 'inventory'
  AND NOT ('PURCHASE_RECOMMENDED' = ANY(event_subscriptions));
