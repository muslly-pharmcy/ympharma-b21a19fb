CREATE OR REPLACE FUNCTION public.agent_workforce_summary()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_out jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  WITH last_run AS (
    SELECT DISTINCT ON (agent) agent::text AS agent, started_at, finished_at, status, summary,
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
