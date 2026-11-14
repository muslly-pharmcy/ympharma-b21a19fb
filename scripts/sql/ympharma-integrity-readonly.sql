-- YmPharma Phase 3 reconciliation and integrity probes.
-- STRICTLY READ-ONLY. Empty tables are NOT evidence of an accepted sales flow.
-- Run against an authorized staging database and separately against production metadata.

-- 1. Actual document/ledger presence: distinguish empty data from passing checks.
SELECT
 (SELECT count(*) FROM ym.products) AS erp_products,
 (SELECT count(*) FROM ym.invoices) AS erp_invoices,
 (SELECT count(*) FROM ym.journals) AS erp_journals,
 (SELECT count(*) FROM ym.journal_lines) AS erp_journal_lines,
 (SELECT count(*) FROM public.catalog_products) AS website_catalog_products,
 (SELECT count(*) FROM public.inv_stock_batches) AS website_stock_batches,
 (SELECT count(*) FROM public.orders) AS website_orders,
 (SELECT count(*) FROM ym.store_product_links) AS linked_store_products;

-- 2. Exact debit/credit check for posted ERP journals, accounting for journal tenant ownership.
WITH line_totals AS (
 SELECT org_id, journal_id, count(*) AS line_count,
        coalesce(sum(debit), 0) AS debits,
        coalesce(sum(credit), 0) AS credits
 FROM ym.journal_lines GROUP BY org_id, journal_id
)
SELECT
 count(*) AS journals,
 count(*) FILTER (WHERE lower(j.status::text) = 'posted') AS posted,
 count(*) FILTER (WHERE lower(j.status::text) = 'posted'
   AND (coalesce(l.line_count, 0) < 2 OR coalesce(l.debits, 0) <> coalesce(l.credits, 0))) AS posted_invalid,
 count(*) FILTER (WHERE j.reversal_of = j.id) AS self_reversals
FROM ym.journals j
LEFT JOIN line_totals l ON l.org_id = j.org_id AND l.journal_id = j.id;

-- 3. Guard parallel legacy accounting path too; do not assume equal schema or ownership.
WITH line_totals AS (
 SELECT entry_id, count(*) AS line_count,
        coalesce(sum(base_debit), 0) AS base_debits,
        coalesce(sum(base_credit), 0) AS base_credits
 FROM public.acc_journal_lines GROUP BY entry_id
)
SELECT count(*) AS entries,
       count(*) FILTER (WHERE e.status::text = 'posted') AS posted,
       count(*) FILTER (WHERE e.status::text = 'posted'
         AND (coalesce(l.line_count, 0) < 2 OR coalesce(l.base_debits, 0) <> coalesce(l.base_credits, 0))) AS posted_invalid
FROM public.acc_journal_entries e
LEFT JOIN line_totals l ON l.entry_id = e.id;

-- 4. Inventory invariants: two independent inventory models.
SELECT
 (SELECT count(*) FROM ym.batches WHERE quantity < 0 OR reserved < 0 OR reserved > quantity) AS invalid_erp_batches,
 (SELECT count(*) FROM public.inv_stock_batches
   WHERE qty_on_hand < 0 OR qty_reserved < 0 OR qty_reserved > qty_on_hand) AS invalid_store_batches,
 (SELECT count(*) FROM ym.batches
   WHERE expiry_date < current_date AND quantity > 0) AS expired_erp_stock_batches,
 (SELECT count(*) FROM public.inv_stock_batches
   WHERE expiry_date < current_date AND qty_on_hand > 0) AS expired_store_stock_batches;

-- 5. Defense-in-depth trigger presence, not a substitute for negative security tests.
SELECT n.nspname AS schema_name, c.relname AS table_name,
       t.tgname AS trigger_name, t.tgenabled AS enabled
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE NOT t.tgisinternal
  AND ((n.nspname = 'ym' AND c.relname IN ('journals','journal_lines','invoices'))
       OR (n.nspname = 'public' AND c.relname IN ('acc_journal_entries','acc_journal_lines')))
ORDER BY 1,2,3;

-- 6. ERP sync contract prerequisites: current API references these objects.
SELECT required.item, to_regclass(required.item) IS NOT NULL AS exists
FROM (VALUES ('public.erp_item_map'),('public.erp_branch_map'),
             ('public.erp_idempotency'),('public.erp_outbound_queue'),
             ('public.erp_stock_snapshots'),('public.erp_sync_conflicts')) AS required(item);

SELECT required.fn, to_regprocedure(required.fn) IS NOT NULL AS exists
FROM (VALUES ('public.erp_claim_idempotency(text,text,text)'),
             ('public.erp_finish_idempotency(text,jsonb,boolean)'),
             ('public.erp_apply_stock_snapshots(jsonb)')) AS required(fn);

-- 7. Index and table-statistics footprint for scoping real staging performance tests.
SELECT schemaname, relname, n_live_tup, seq_scan, idx_scan, n_dead_tup
FROM pg_stat_user_tables
WHERE schemaname IN ('ym','public')
  AND relname IN ('invoices','journals','journal_lines','batches','catalog_products','inv_stock_batches','orders','erp_stock_snapshots')
ORDER BY schemaname, relname;
