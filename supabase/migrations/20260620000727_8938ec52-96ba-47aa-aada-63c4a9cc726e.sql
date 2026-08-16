
-- 1) Inventory Agent
create or replace function public.inventory_intel()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_low jsonb; v_oos jsonb; v_expiry jsonb; v_dead jsonb; v_total_at_risk numeric := 0;
begin
  select coalesce(jsonb_agg(row_to_json(t) order by t.stock_qty asc), '[]'::jsonb) into v_low from (
    select p.legacy_id, p.name, p.brand, p.stock_qty, p.reorder_point, p.price,
           greatest(p.reorder_point * 2 - p.stock_qty, p.reorder_point) as suggested_reorder
    from products p
    where p.is_published and p.track_stock and p.stock_qty > 0 and p.stock_qty <= p.reorder_point
    order by p.stock_qty asc limit 50) t;

  select coalesce(jsonb_agg(row_to_json(t) order by t.price desc), '[]'::jsonb) into v_oos from (
    select p.legacy_id, p.name, p.brand, p.price, p.reorder_point
    from products p where p.is_published and p.track_stock and p.stock_qty <= 0
    order by p.price desc limit 50) t;

  select coalesce(jsonb_agg(row_to_json(t) order by t.expiry_date asc), '[]'::jsonb) into v_expiry from (
    select p.legacy_id, p.name, p.brand, p.stock_qty, p.expiry_date, p.price,
           (p.expiry_date - current_date) as days_to_expiry,
           (p.stock_qty * p.price) as value_at_risk
    from products p
    where p.is_published and p.expiry_date is not null
      and p.expiry_date <= current_date + interval '60 days' and p.stock_qty > 0
    order by p.expiry_date asc limit 50) t;

  select coalesce(sum((value->>'value_at_risk')::numeric), 0) into v_total_at_risk
  from jsonb_array_elements(v_expiry) value;

  with sold as (
    select (item->>'id')::int as legacy_id
    from orders o cross join lateral jsonb_array_elements(o.items) item
    where o.status in ('confirmed','shipped','delivered')
      and o.created_at >= now() - interval '60 days'
      and (item->>'id') ~ '^[0-9]+$'
    group by (item->>'id')::int)
  select coalesce(jsonb_agg(row_to_json(t) order by (t.stock_qty * t.price) desc), '[]'::jsonb) into v_dead from (
    select p.legacy_id, p.name, p.brand, p.stock_qty, p.price,
           (p.stock_qty * p.price) as tied_capital, p.expiry_date
    from products p
    where p.is_published and p.stock_qty > 0 and p.legacy_id is not null
      and not exists (select 1 from sold s where s.legacy_id = p.legacy_id)
    order by (p.stock_qty * p.price) desc limit 30) t;

  return jsonb_build_object('low_stock', v_low, 'out_of_stock', v_oos, 'near_expiry', v_expiry,
    'dead_stock', v_dead, 'near_expiry_value_at_risk', v_total_at_risk, 'generated_at', now());
end; $$;
revoke all on function public.inventory_intel() from public, anon;
grant execute on function public.inventory_intel() to authenticated, service_role;

-- 2) Sales Agent
create or replace function public.sales_opportunities()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_fbt jsonb; v_top_rev jsonb; v_top_margin jsonb;
begin
  with order_items as (
    select o.id, (item->>'id')::int as legacy_id, (item->>'name') as name
    from orders o cross join lateral jsonb_array_elements(o.items) item
    where o.status in ('confirmed','shipped','delivered')
      and o.created_at >= now() - interval '90 days'
      and (item->>'id') ~ '^[0-9]+$'),
  pairs as (
    select a.legacy_id as a_id, a.name as a_name, b.legacy_id as b_id, b.name as b_name, count(*) as freq
    from order_items a join order_items b on b.id = a.id and b.legacy_id > a.legacy_id
    group by a.legacy_id, a.name, b.legacy_id, b.name
    having count(*) >= 2 order by count(*) desc limit 20)
  select coalesce(jsonb_agg(row_to_json(p)), '[]'::jsonb) into v_fbt from pairs p;

  with sales as (
    select (item->>'id')::int as legacy_id, (item->>'name') as name,
           sum(((item->>'qty')::numeric) * ((item->>'price')::numeric)) as revenue,
           sum(((item->>'qty')::numeric)) as units
    from orders o cross join lateral jsonb_array_elements(o.items) item
    where o.status in ('confirmed','shipped','delivered')
      and o.created_at >= now() - interval '30 days'
      and (item->>'id') ~ '^[0-9]+$'
    group by 1, 2)
  select coalesce(jsonb_agg(row_to_json(t) order by t.revenue desc), '[]'::jsonb) into v_top_rev
  from (select * from sales order by revenue desc limit 15) t;

  with sales as (
    select (item->>'id')::int as legacy_id, (item->>'name') as name,
           sum(((item->>'qty')::numeric) * ((item->>'price')::numeric)) as revenue,
           sum(((item->>'qty')::numeric)) as units
    from orders o cross join lateral jsonb_array_elements(o.items) item
    where o.status in ('confirmed','shipped','delivered')
      and o.created_at >= now() - interval '30 days'
      and (item->>'id') ~ '^[0-9]+$'
    group by 1, 2)
  select coalesce(jsonb_agg(row_to_json(t) order by t.gross_margin desc), '[]'::jsonb) into v_top_margin from (
    select s.legacy_id, s.name, s.units, s.revenue,
           (s.revenue - (s.units * coalesce(p.supplier_cost, 0))) as gross_margin,
           case when s.revenue > 0
                then round(((s.revenue - (s.units * coalesce(p.supplier_cost, 0))) / s.revenue) * 100, 1)
                else 0 end as margin_pct
    from sales s join products p on p.legacy_id = s.legacy_id
    where p.supplier_cost is not null and p.supplier_cost > 0
    order by gross_margin desc limit 15) t;

  return jsonb_build_object('frequently_bought_together', v_fbt,
    'top_revenue', v_top_rev, 'top_margin', v_top_margin, 'generated_at', now());
end; $$;
revoke all on function public.sales_opportunities() from public, anon;
grant execute on function public.sales_opportunities() to authenticated, service_role;

-- 3) CTO Agent
create or replace function public.cto_health()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_24h int := 0; v_7d int := 0; v_by_source jsonb; v_recent jsonb; v_uptime_incidents int := 0;
begin
  select count(*) into v_24h from error_logs where occurred_at >= now() - interval '24 hours';
  select count(*) into v_7d  from error_logs where occurred_at >= now() - interval '7 days';
  select coalesce(jsonb_agg(row_to_json(t) order by t.errors desc), '[]'::jsonb) into v_by_source from (
    select source, level, count(*) as errors from error_logs
    where occurred_at >= now() - interval '7 days'
    group by source, level order by count(*) desc limit 20) t;
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_recent from (
    select id, occurred_at, level, source, message, url from error_logs
    where occurred_at >= now() - interval '24 hours' and level in ('error','warn')
    order by occurred_at desc limit 25) t;
  begin
    select count(*) into v_uptime_incidents from uptime_incidents
    where started_at >= now() - interval '7 days';
  exception when others then v_uptime_incidents := 0;
  end;
  return jsonb_build_object('errors_24h', v_24h, 'errors_7d', v_7d, 'by_source', v_by_source,
    'recent', v_recent, 'uptime_incidents_7d', v_uptime_incidents, 'generated_at', now());
end; $$;
revoke all on function public.cto_health() from public, anon;
grant execute on function public.cto_health() to authenticated, service_role;

-- 4) Executive alerts
create or replace function public.executive_alerts()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb := '[]'::jsonb; v_lost numeric; v_oos int; v_low int; v_expiry_value numeric; v_err_24h int; v_queue_pending int;
begin
  select coalesce(sum(total),0) into v_lost from orders
   where status='cancelled' and created_at >= now() - interval '30 days';
  if v_lost > 0 then v := v || jsonb_build_array(jsonb_build_object(
    'severity', case when v_lost >= 100000 then 'critical' when v_lost >= 25000 then 'high' else 'medium' end,
    'kind','revenue_lost','title','إيراد مفقود خلال 30 يوم',
    'body', concat('قيمة الطلبات الملغاة: ', round(v_lost), ' ر.ي'),
    'value', v_lost, 'cta', '/admin-marketing')); end if;

  select count(*) into v_oos from products where is_published and track_stock and stock_qty <= 0;
  if v_oos > 0 then v := v || jsonb_build_array(jsonb_build_object(
    'severity', case when v_oos >= 20 then 'critical' when v_oos >= 5 then 'high' else 'medium' end,
    'kind','stock_out','title','منتجات نافدة من المخزون',
    'body', concat(v_oos, ' منتج خارج المخزون الآن'),
    'value', v_oos, 'cta','/admin-inventory')); end if;

  select count(*) into v_low from products
   where is_published and track_stock and stock_qty > 0 and stock_qty <= reorder_point;
  if v_low > 0 then v := v || jsonb_build_array(jsonb_build_object(
    'severity', case when v_low >= 20 then 'high' else 'medium' end,
    'kind','stock_low','title','منتجات قاربت على النفاد',
    'body', concat(v_low, ' منتج عند/تحت نقطة إعادة الطلب'),
    'value', v_low, 'cta','/admin-inventory')); end if;

  select coalesce(sum(stock_qty * price), 0) into v_expiry_value from products
  where is_published and expiry_date is not null
    and expiry_date <= current_date + interval '60 days' and stock_qty > 0;
  if v_expiry_value > 0 then v := v || jsonb_build_array(jsonb_build_object(
    'severity', case when v_expiry_value >= 50000 then 'high' else 'medium' end,
    'kind','near_expiry','title','مخزون قارب على انتهاء الصلاحية',
    'body', concat('قيمة معرّضة: ', round(v_expiry_value), ' ر.ي خلال 60 يوم'),
    'value', v_expiry_value, 'cta','/admin-inventory')); end if;

  select count(*) into v_err_24h from error_logs
   where occurred_at >= now() - interval '24 hours' and level='error';
  if v_err_24h > 0 then v := v || jsonb_build_array(jsonb_build_object(
    'severity', case when v_err_24h >= 50 then 'critical' when v_err_24h >= 10 then 'high' else 'medium' end,
    'kind','errors','title','أخطاء برمجية خلال 24 ساعة',
    'body', concat(v_err_24h, ' حدث خطأ'), 'value', v_err_24h, 'cta','/admin-logs')); end if;

  select count(*) into v_queue_pending from marketing_queue where status='pending';
  if v_queue_pending >= 10 then v := v || jsonb_build_array(jsonb_build_object(
    'severity','medium','kind','queue_backlog','title','حملات بانتظار الموافقة',
    'body', concat(v_queue_pending, ' عنصر في طابور التسويق'),
    'value', v_queue_pending, 'cta','/admin-marketing')); end if;

  return jsonb_build_object('alerts', v, 'generated_at', now());
end; $$;
revoke all on function public.executive_alerts() from public, anon;
grant execute on function public.executive_alerts() to authenticated, service_role;

-- 5) Customer enrichment helpers
create or replace function public.customers_for_enrichment(_limit int default 50)
returns table(phone text, name text, orders_count int, total_spent numeric,
  last_order_at timestamptz, dominant_category text, top_categories jsonb,
  chronic_flags jsonb, value_score int, health_score int, segment text)
language sql stable security definer set search_path = public as $$
  select p.phone, p.name, p.orders_count, p.total_spent, p.last_order_at,
         p.dominant_category, p.top_categories, p.chronic_flags,
         coalesce(s.value_score,0), coalesce(s.health_score,50), coalesce(s.segment,'new')
  from customer_profiles p
  left join customer_scores s on s.phone = p.phone
  where p.orders_count >= 1
    and (p.ai_insight is null or p.ai_insight_at < now() - interval '7 days')
  order by coalesce(s.value_score,0) desc, p.total_spent desc
  limit greatest(1, least(_limit, 200));
$$;
revoke all on function public.customers_for_enrichment(int) from public, anon;
grant execute on function public.customers_for_enrichment(int) to authenticated, service_role;

create or replace function public.save_customer_ai_insight(_phone text, _insight text)
returns void language sql security definer set search_path = public as $$
  update customer_profiles set ai_insight = _insight, ai_insight_at = now(), updated_at = now()
  where phone = _phone;
$$;
revoke all on function public.save_customer_ai_insight(text, text) from public, anon;
grant execute on function public.save_customer_ai_insight(text, text) to authenticated, service_role;

-- 6) Weekly executive report builder
create or replace function public.weekly_exec_report_build()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_dash jsonb; v_inv jsonb; v_sales jsonb; v_cto jsonb; v_alerts jsonb;
  v_rev_week numeric; v_rev_prev numeric; v_growth numeric; v_payload jsonb;
begin
  select exec_dashboard() into v_dash;
  select inventory_intel() into v_inv;
  select sales_opportunities() into v_sales;
  select cto_health() into v_cto;
  select executive_alerts() into v_alerts;

  select coalesce(sum(total),0) into v_rev_week from orders
   where status in ('confirmed','shipped','delivered') and created_at >= now() - interval '7 days';
  select coalesce(sum(total),0) into v_rev_prev from orders
   where status in ('confirmed','shipped','delivered')
     and created_at >= now() - interval '14 days' and created_at < now() - interval '7 days';
  v_growth := case when v_rev_prev > 0 then round(((v_rev_week - v_rev_prev) / v_rev_prev) * 100, 1) else null end;

  v_payload := jsonb_build_object('kind','weekly','revenue_week', v_rev_week,
    'revenue_prev_week', v_rev_prev, 'growth_pct', v_growth,
    'dashboard', v_dash, 'inventory', v_inv, 'sales', v_sales,
    'cto', v_cto, 'alerts', v_alerts, 'generated_at', now());

  insert into executive_reports(day, payload) values (current_date, v_payload)
    on conflict (day) do update set payload = excluded.payload, created_at = now();

  insert into agent_runs(agent, kind, status, finished_at, summary, impact_estimate, confidence, details)
  values ('ceo','weekly_report','ok', now(),
    concat('تقرير أسبوعي — إيراد: ', round(v_rev_week), ' ر.ي • نمو: ', coalesce(v_growth::text,'—'), '%'),
    v_rev_week, 95, v_payload);

  return v_payload;
end; $$;
revoke all on function public.weekly_exec_report_build() from public, anon;
grant execute on function public.weekly_exec_report_build() to service_role;

create or replace function public.latest_executive_report()
returns jsonb language sql stable security definer set search_path = public as $$
  select payload from executive_reports order by day desc limit 1;
$$;
revoke all on function public.latest_executive_report() from public, anon;
grant execute on function public.latest_executive_report() to authenticated, service_role;
