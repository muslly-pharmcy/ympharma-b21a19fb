-- YmPharma 2026-11-14 non-destructive security audit.
-- Read-only metadata/results. NOT a substitute for negative role-scoped RLS/RPC tests.
-- Do not execute corrective GRANT/REVOKE/DDL in this script.

-- 1. SECURITY DEFINER entry points in exposed schema: review intentional public RPCs individually.
SELECT p.oid::regprocedure::text AS function_signature,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
       coalesce(array_to_string(p.proconfig, ','), '<none>') AS function_settings
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef
  AND (has_function_privilege('anon', p.oid, 'EXECUTE')
       OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
ORDER BY anon_can_execute DESC, function_signature;

-- 2. RLS policy count and client grants, distinguishing intentional deny-all tables.
WITH policies AS (SELECT polrelid, COUNT(*) AS policy_count FROM pg_policy GROUP BY polrelid)
SELECT n.nspname AS schema_name, c.relname AS table_name,
       c.relrowsecurity AS rls_enabled, coalesce(p.policy_count,0) AS policy_count,
       has_table_privilege('anon',c.oid,'SELECT') AS anon_can_select,
       has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated_can_select
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN policies p ON p.polrelid=c.oid
WHERE n.nspname IN ('ym','public') AND c.relkind IN ('r','p')
  AND (NOT c.relrowsecurity OR coalesce(p.policy_count,0)=0)
ORDER BY n.nspname,c.relname;

-- 3. Exact decimal precision for financial values in both live accounting models.
SELECT table_schema,table_name,column_name,numeric_precision,numeric_scale
FROM information_schema.columns
WHERE table_schema IN ('ym','public') AND data_type='numeric'
AND (
    (table_schema='ym' AND table_name IN
       ('invoices','invoice_lines','journals','journal_lines','inventory_cost_events'))
    OR (table_schema='public' AND table_name IN
       ('acc_journal_entries','acc_journal_lines','inv_stock_batches'))
)
ORDER BY table_schema,table_name,ordinal_position;

-- 4. Data presence is a release condition: zero journals cannot validate posting correctness.
SELECT (SELECT COUNT(*) FROM ym.products) AS erp_products,
       (SELECT COUNT(*) FROM ym.invoices) AS erp_invoices,
       (SELECT COUNT(*) FROM ym.journals) AS erp_journals,
       (SELECT COUNT(*) FROM ym.store_product_links) AS erp_store_links,
       (SELECT COUNT(*) FROM public.catalog_products) AS public_catalog_products,
       (SELECT COUNT(*) FROM public.inv_stock_batches) AS store_stock_batches;

-- 5. Scope of critical client grants; table permission alone never proves row-level authorization.
SELECT target.table_name,
       has_table_privilege('anon', target.table_name, 'SELECT') AS anon_select,
       has_table_privilege('authenticated', target.table_name, 'SELECT') AS authenticated_select,
       has_table_privilege('authenticated', target.table_name, 'INSERT') AS authenticated_insert
FROM (VALUES
  ('ym.products'), ('ym.batches'), ('ym.invoices'), ('ym.journals'), ('ym.journal_lines'),
  ('public.catalog_products'), ('public.inv_stock_batches')
) AS target(table_name);
