# Schema drift — YMP-001

Source inspected at `949a63bd511381e82efc67616bb0a3159a2e9025` on 2026-11-15. Live schema and migration history: **BLOCKED**, unavailable Supabase connector and no configured authenticated SQL connection. The 2026-11-14 portfolio audit contains historical observations, not fresh verification.

| Area | Observed source | Decision / missing evidence |
| --- | --- | --- |
| Supabase history | 254 SQL files in `supabase/migrations` | Not proof that all or any are applied to the configured backend |
| Drizzle history | 7 SQL files; `_journal.json` registers only 0000–0005 | 0006 exists but is not journaled; do not append or replay automatically |
| Migration runner | drizzle.config.ts uses LOVABLE_DB_MIGRATION_URL; Supabase has its own migration directory | Single authoritative deployment runner remains unconfirmed; recommend Supabase for new public-schema remediation only after DB owner reconciliation |
| Checkout ACL | July checkout grants authenticated; August dynamic SECURITY DEFINER sweep revokes it; Drizzle 0002 restores it | Effective live ACL depends on actual application order; a blind GRANT is not an authorization fix |
| Checkout body | Drizzle 0003 changes search_path; 0004 rewrites function pricing | Retrieve pg_get_functiondef and compare, not just migration filenames |
| Billing contract | SQL and generated types define entry_type/amount_yer/notes; server selects direction/category/amount_cents/description | Definite source mismatch; live manifestation unverified |
| Billing semantics | Linked to billing_invoices and billing_subscriptions; amount_yer numeric(12,2) | No basis for treating every charge as pharmacy revenue or changing to NUMERIC(15,4) without contract review |
| Inventory | Browser server functions write batch balances outside inv_* RPCs | Need effective table grants, RLS, constraints, triggers and RPC definitions before remediation |

## Required read-only metadata

Run `scripts/production/g0-readonly-metadata.sql` through a trusted read-only SQL connection to the verified project and separately identified staging project. It collects no patient, invoice, order or inventory rows. Keep returned function definitions and policy expressions local. The script discovers history relations and their columns; retrieving history rows is a separate read-only step after confirming names and privileges. Record any missing or inaccessible relation explicitly. The script has not been executed against PostgreSQL.

Compare remote version/name/hash against a SHA-256 manifest of the local SQL files. PostgreSQL catalogs do not prove backup quality or that migration bodies have remained unchanged. Resolve versions present only on one side and function-body mismatches with the DB owner before selecting a single runner.

## Graphify findings revalidated with source

- FinanceModule uses a constant query key and calls fetchTx without the selected period; returned warning is ignored and missing data becomes an empty list / zero totals.
- setProductStockBalance checks product organization but aggregates across organization warehouses, ignores reserved quantities, reads and writes in separate requests and lacks a stable idempotency key.
- bulkImportExcel uses global admin role plus service client, matches products by unscoped store_code, embeds fixed organization/warehouse IDs, directly changes batches and ignores stock-write errors. It also marks imports approved/public and invents an expiry date.
- useShopifyCartSync appears only at its definition in src. This does not establish 12-hour offline POS capability.
- Direct source search supplements Graphify; absent graph edges cannot prove absence of runtime callers.
