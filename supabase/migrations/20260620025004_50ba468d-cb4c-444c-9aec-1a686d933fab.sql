CREATE OR REPLACE FUNCTION public.run_sales_worker()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_recs int := 0; v_pair RECORD; v_total_orders int;
BEGIN
  SELECT COUNT(*) INTO v_total_orders FROM public.orders
    WHERE created_at >= now() - interval '60 days' AND status <> 'cancelled';

  FOR v_pair IN
    WITH items AS (
      SELECT o.id AS oid, (it->>'name') AS name, (it->>'id') AS pid
      FROM public.orders o, jsonb_array_elements(COALESCE(o.items,'[]'::jsonb)) it
      WHERE o.created_at >= now() - interval '60 days' AND o.status <> 'cancelled'
    ), pairs AS (
      SELECT a.name AS a, b.name AS b, COUNT(DISTINCT a.oid)::int AS c
      FROM items a JOIN items b ON a.oid = b.oid AND a.name < b.name
      WHERE a.name IS NOT NULL AND b.name IS NOT NULL
      GROUP BY a.name, b.name HAVING COUNT(DISTINCT a.oid) >= 3
    )
    SELECT * FROM pairs ORDER BY c DESC LIMIT 10
  LOOP
    PERFORM public._agent_rec_upsert(
      'sales'::text, 'sales'::text,
      format('عرض مشترك: %s + %s', v_pair.a, v_pair.b),
      format('تم شراؤهما معاً في %s طلبات. اقترحهما كحزمة بخصم 5-8%%.', v_pair.c),
      jsonb_build_object('item_a',v_pair.a,'item_b',v_pair.b,'co_count',v_pair.c),
      (v_pair.c * 500)::numeric,
      LEAST(95, 40 + v_pair.c*5)::int,
      'sales_pair_'||md5(v_pair.a||'|'||v_pair.b)||'_'||to_char(CURRENT_DATE,'IYYY-IW'));
    v_recs := v_recs + 1;
  END LOOP;

  PERFORM public._agent_kpi_upsert('sales','cross_sell_score',
    LEAST(100, v_recs*10)::numeric, jsonb_build_object('pairs_found',v_recs,'orders_analyzed',v_total_orders));
  PERFORM public._agent_kpi_upsert('sales','upsell_score',
    CASE WHEN v_total_orders>0 THEN LEAST(100, v_recs*8)::numeric ELSE 0::numeric END,
    jsonb_build_object('orders_60d',v_total_orders));

  RETURN jsonb_build_object('findings_count', v_recs, 'recommendations_count', v_recs,
    'summary', format('%s فرصة بيع مشترك من تحليل %s طلب', v_recs, v_total_orders),
    'details', jsonb_build_object('pairs',v_recs));
END $$;

GRANT EXECUTE ON FUNCTION public.run_sales_worker() TO authenticated, service_role;
