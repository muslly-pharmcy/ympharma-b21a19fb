-- Fix 1: Create missing revenue_by_condition(_days) RPC
CREATE OR REPLACE FUNCTION public.revenue_by_condition(_days integer DEFAULT 30)
RETURNS TABLE(condition text, revenue numeric, orders_count integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  WITH items AS (
    SELECT o.id AS order_id,
           (it->>'legacy_id')::int AS legacy_id,
           COALESCE((it->>'price')::numeric,0) * COALESCE((it->>'qty')::numeric,1) AS line_total
    FROM public.orders o
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.items,'[]'::jsonb)) AS it
    WHERE o.created_at >= now() - make_interval(days => _days)
      AND COALESCE(o.status,'') <> 'cancelled'
  ),
  joined AS (
    SELECT unnest(pc.conditions) AS cond, i.line_total, i.order_id
    FROM items i
    JOIN public.product_classifications pc ON pc.product_legacy_id = i.legacy_id
    WHERE pc.conditions IS NOT NULL AND array_length(pc.conditions,1) > 0
  )
  SELECT cond, SUM(line_total)::numeric, COUNT(DISTINCT order_id)::int
  FROM joined
  GROUP BY cond
  ORDER BY SUM(line_total) DESC NULLS LAST
  LIMIT 50;
END $$;

REVOKE ALL ON FUNCTION public.revenue_by_condition(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revenue_by_condition(integer) TO authenticated, service_role;

-- Fix 2: chronic_overdue — Postgres does not short-circuit WHERE, wrap
-- the jsonb_array_length call in CASE so non-array rows never reach it.
CREATE OR REPLACE FUNCTION public.chronic_overdue(_grace numeric DEFAULT 1.5)
RETURNS TABLE(phone text, name text, last_order_at timestamp with time zone, days_since integer, days_between numeric, chronic_flags jsonb, dominant_category text, total_spent numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT cp.phone, cp.name, cp.last_order_at,
    extract(day from (now() - cp.last_order_at))::int,
    cp.days_between_orders, cp.chronic_flags, cp.dominant_category, cp.total_spent
  FROM public.customer_profiles cp
  WHERE cp.chronic_flags IS NOT NULL
    AND jsonb_typeof(cp.chronic_flags) = 'array'
    AND (CASE WHEN jsonb_typeof(cp.chronic_flags) = 'array'
              THEN jsonb_array_length(cp.chronic_flags) ELSE 0 END) > 0
    AND cp.last_order_at IS NOT NULL
    AND cp.days_between_orders IS NOT NULL
    AND cp.days_between_orders > 0
    AND (now() - cp.last_order_at) > make_interval(days => (cp.days_between_orders * _grace)::int)
  ORDER BY cp.total_spent DESC NULLS LAST
  LIMIT 100;
END $$;

-- Fix 3: run_all_agents_now — cast text agent name to valid_agent_modes enum
CREATE OR REPLACE FUNCTION public.run_all_agents_now()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_results jsonb := '{}'::jsonb;
        v_agents text[] := ARRAY['ceo','cto','sales','inventory','operations','marketing','cx','bi'];
        v_a text; v_run_id uuid; v_start timestamptz; v_res jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  FOREACH v_a IN ARRAY v_agents LOOP
    v_start := clock_timestamp();
    INSERT INTO public.agent_runs(agent, kind, status, started_at)
      VALUES (v_a::public.valid_agent_modes, 'manual', 'running', v_start)
      RETURNING id INTO v_run_id;
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
