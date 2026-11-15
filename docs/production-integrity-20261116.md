# YmPharma integrity work — 16 November 2026 (Asia/Aden)

Repository: muslly-pharmcy/ympharma-b21a19fb. Base: 949a63bd511381e82efc67616bb0a3159a2e9025, fetched from origin/main before editing.
Branch: fix/production-integrity-20261116. This is a staging candidate, not a production release.

## Observed live metadata (read only)

The configured Supabase project is `ybhrmcdlgyccywpmiucz` (MUSALLY PHARMA). No other database was queried or modified.

- `checkout_cart_fefo(text,text,text,uuid,text,text)` currently permits authenticated/service_role and denies anon. Restoring the grant is unnecessary on this database.
- Live checkout is SECURITY DEFINER with search_path=public; its definition uses auth.uid() and the owner's cart. Its definition still uses batch selling_price with a zero fallback and does NOT contain the catalog-price fallback in Drizzle 0004. This proves deployment drift, not a reason to silently apply a text replacement.
- `billing_ledger` really has entry_type, amount_yer, notes. amount_yer is NUMERIC(12,2), not NUMERIC(15,4). This patch does not rewrite financial history or change precision.
- Billing SELECT RLS is app-admin only and has no organization column. It is a platform subscription ledger, not the tenant ERP general ledger.
- The three-argument inv_adjust_stock overload remains executable by authenticated; the five-argument overload is service-only. Review the old overload and direct batch-write RLS before declaring all stock entry points hardened.

## Implemented

1. Billing reads use real columns, caller-scoped RLS, explicit administrator authorization, and server-side half-open calendar ranges in Asia/Aden. Weeks begin Saturday. The screen displays exact received decimal text and a bounded list (100 rows, explicit truncation). It does not derive revenue, expenses or profit from ambiguous subscription entry types. SQL/auth errors show a retryable error rather than a zero/empty success.
2. Admin stock sets now require an observed balance and UUID idempotency key. The new service-only RPC locks the product and existing batches, checks active org-wide membership, database inventory permission, warehouse ownership/activity, reservations and stale balances; each changed batch uses the existing inv_adjust_stock function. Request results and stock/movement/event mutations commit together. Branch-scoped actors must use batch-specific workflows.
3. New stock reservation constraint rejects qty_reserved > qty_on_hand, including writes through other paths. Migration validation intentionally aborts if historical violations exist.
4. Increases require exactly one existing batch with an actual batch number and future expiry; no lot/expiry is fabricated. New-product stock needs the receipt workflow. Multiple-batch increases need explicit batch selection. Admin product creation no longer attempts an unaudited initial stock insert.
5. Excel imports reject nonzero stock before writes. They derive the organization from the authenticated actor, scope lookups/updates, check read errors, and insert new products as private prescription-review drafts. Existing review/prescription flags are preserved. This intentionally replaces the old auto-publication and invented 540-day expiry behavior. Catalog metadata rows remain individually processed and reported, not one atomic whole-file import.
6. Added metadata-only checkout drift checks and disposable PostgreSQL acceptance/20-connection concurrency workflow.

## Validation

- Frozen-lockfile dependency installation: PASS. No dependency/lockfile changes.
- Unit/integration/UI tests: 553 PASS, 8 SKIPPED; includes 30 tests for this patch.
- TypeScript `tsc --noEmit`: PASS with restored complete dependencies.
- ESLint: PASS.
- Node production build: PASS.
- Cloudflare build: PASS. Completing Wrangler dry-run validation was BLOCKED by automatic approval review because it may export the bundle to a third party; it is not recorded as an approved deployment check. No retry or publish performed.
- Local PostgreSQL-WASM acceptance: PASS using actual historical inv_adjust_stock body and synthetic membership/event fixtures. Covers execute grants, reservation protection, tenant/branch rejection, second-movement failure rollback, UUID replay/payload conflict and stale-screen rejection. This is not a multi-connection checkout load test.
- Graphify rebuild: 873 files, 5,669 nodes, 12,102 relationships, 389 communities. Partial extraction in 3 Gradle files and generated Supabase types; 131 files yielded no symbols. Graph output stays local/ignored. Relationships are a navigation aid, not test evidence.
- Native PostgreSQL 18.6: PASS for the same acceptance suite and a real 20-connection race (1 success, 19 explicit stale-balance rejections, final stock 14.000). CI repeats on PostgreSQL 17. This tests administrative compare-and-set, not 500 simultaneous checkout attempts.
- UI behavior: PASS in jsdom for period switching, exact decimal display, truncation notice, RTL container and SQL-error retry. Chromium viewport screenshots: BLOCKED by the environment denying its Unix-domain socket; no visual/device pass is claimed.
- Physical Android/Windows/iPad tests, 12-hour offline sales, 500 simultaneous checkouts and monthly-capacity benchmark: NOT RUN.

## Deployment order and rollback

Do not deploy the stock client before the new RPC. Review/apply `drizzle/migrations/0007_atomic_admin_stock_set.sql` as one transaction to an isolated staging database first; run acceptance tests there using synthetic fixtures only in a disposable database. Recheck the existing inv_adjust_stock implementation and inv_emit behavior against staging. Fixtures are destructive to disposable schemas and must NEVER run on Supabase.

Before production: backup, check reservation violations, verify runtime role privileges, inspect checkout drift and test a real staging customer flow including foreign-cart denial. Do not run the synthetic load harness on production. A platform-level billing read is not a tenant financial report; connect the latter to the approved ym accounting model separately.

Rollback before application: discard the branch. After staging application: keep stock-set permissions disabled while reverting the UI; retain replay rows, movements and events. Do not restore the old direct-write stock path for production or delete posted movements. Use reviewed forward fixes/reversal movements for already committed stock corrections. Do not automatically drop the reservation constraint or replay table.

## Remaining priority order

1. Reconcile checkout migrations in staging (grant is already correct; live price definition is stale). Runtime ownership, expiry/recall, price, idempotency and concurrent checkout still need acceptance tests.
2. Verify this stock migration against full staging schema, old overload ACLs and every direct batch writer; complete controlled receipt/import with real lots, expiries, quantities and review.
3. Bind financial reports to actual tenant/branch journals, currency policy and exact database aggregates; review existing NUMERIC(12,2) billing precision separately.
4. Implement a documented POS offline contract with device quotas, transactional outbox, replay and reconciliation. Shopify's localStorage cart queue is not POS offline sales. Its existing store methods swallow some network errors; simply mounting the sync hook could incorrectly acknowledge failed entries. No hook was wired without fixing that contract.
5. Benchmark concurrency and 100,000-invoice monthly target; validate real Android, Windows and iPad builds and release credentials.

## Publication status

Implementation commit: b0f720a82da1bfc40f29e04bf19a40fb603c2699. Initial GitHub publication was blocked pending scoped approval. The owner subsequently explicitly authorized this branch to muslly-pharmcy/ympharma-b21a19fb. Git CLI publication has no credentials in this environment; publication proceeds through the authenticated GitHub connector. The PR remains a draft pending staging validation. Production schema and inventory remain unchanged.
