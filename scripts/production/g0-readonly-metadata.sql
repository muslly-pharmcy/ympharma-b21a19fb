-- G0 metadata only. Execute on the verified target through a read-only session.
-- No application data, secrets, DDL or production writes.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';
SELECT current_database() AS database_name, current_user AS role_name, version();
SELECT table_schema, table_name, column_name, data_type, udt_name,
       numeric_precision, numeric_scale, is_nullable
FROM information_schema.columns
WHERE table_schema IN ('public', 'ym')
  AND table_name IN ('billing_ledger','billing_invoices','billing_subscriptions',
    'inv_stock_batches','inv_stock_movements','organization_members','wh_warehouses',
    'cart_items','orders','catalog_products')
ORDER BY table_schema, table_name, ordinal_position;
SELECT n.nspname, p.oid::regprocedure::text AS signature, p.prosecdef,
       p.proconfig, p.proacl, pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND (p.proname='checkout_cart_fefo' OR p.proname LIKE 'inv\_%' ESCAPE '\')
  AND p.prokind='f'
ORDER BY signature;
SELECT p.oid::regprocedure::text AS signature, r.rolname,
       has_function_privilege(r.oid,p.oid,'EXECUTE') AS can_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
CROSS JOIN pg_roles r
WHERE n.nspname='public' AND p.proname='checkout_cart_fefo'
  AND r.rolname IN ('anon','authenticated','service_role');
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname IN ('public','ym') AND tablename IN
 ('billing_ledger','inv_stock_batches','inv_stock_movements','cart_items','orders','catalog_products');
SELECT n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity,
       con.conname, pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_constraint con ON con.conrelid=c.oid
WHERE n.nspname='public' AND c.relname IN
 ('billing_ledger','inv_stock_batches','inv_stock_movements','cart_items','orders');
SELECT event_object_schema, event_object_table, trigger_name, action_statement
FROM information_schema.triggers
WHERE event_object_schema='public' AND event_object_table IN
 ('billing_ledger','inv_stock_batches','inv_stock_movements','orders');
SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema='public' AND table_name IN
 ('billing_ledger','inv_stock_batches','inv_stock_movements','cart_items','orders');
-- History retrieval is intentionally separate: run SELECT only after confirming
-- these relation names and columns. Do not assume history tables exist.
SELECT n.nspname, c.relname
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE (n.nspname='supabase_migrations' AND c.relname='schema_migrations')
   OR (n.nspname='drizzle' AND c.relname='__drizzle_migrations');
SELECT table_schema,table_name,column_name,data_type
FROM information_schema.columns
WHERE (table_schema='supabase_migrations' AND table_name='schema_migrations')
   OR (table_schema='drizzle' AND table_name='__drizzle_migrations');
ROLLBACK;
