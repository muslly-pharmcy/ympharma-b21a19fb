# YmPharma execution checkpoint — G0 / G1
Date: 2026-11-16. Target repository: `muslly-pharmcy/ympharma-b21a19fb`.

## Evidence and boundaries
- GitHub repository is reachable with push permission; default branch `main`. Graphify last indexed commit `949a63bd511381e82efc67616bb0a3159a2e9025`. The earlier Graphify report is a **static analysis**, not a successful production test.
- Read-only inspection of connected Supabase project **MUSALLY PHARMA** (`ybhrmcdlgyccywpmiucz`), PostgreSQL 17.6. Production/staging classification has **not** been established; no SQL or data mutations were executed.
- `public.checkout_cart_fefo(text,text,text,uuid,text,text)`: `authenticated` currently has EXECUTE, `anon` does not; function is SECURITY DEFINER. This resolves only the historical GRANT ambiguity; internal identity validation and actual checkout still require integration tests.
- `public.billing_ledger`: `entry_type`, `amount_yer`, `notes` exist. `direction`, `category`, `amount_cents`, `description` do **not**. `entry_type` values: charge, refund, credit, adjustment. No records were found at inspection time. Admin-only SELECT policy was found; billing data must not be represented as retail profit/loss.
- `public.inv_stock_batches`: RLS enabled with organization/member read policy and inventory.write write policy; server admin paths may bypass RLS, so role checks and transactions remain necessary.
- `public.inv_adjust_stock(p_batch,p_delta,p_reason,p_actor,p_correlation)` is available, updates a locked batch, respects reservations and writes a movement. It does not by itself implement a fully atomic **product-wide absolute balance** over multiple batches.

## Implemented in this review branch
1. Corrected billing read DTO and query against the live table schema.
2. The requested calendar period filters the server query in Asia/Aden.
3. Query failures are presented as errors, never fabricated zero profit.
4. UI no longer labels billing charges/refunds as pharmacy revenue/expense/profit; counts explicitly cover **up to 100 visible entries**, not period-wide totals.
5. Added unit tests for date boundaries and formatting of serialized decimal amounts.

## Unresolved / release blockers
- YMP-004: `setProductStockBalance` writes to `inv_stock_batches` directly without an atomic product-wide transaction. **Do not deploy as a fix for stock reconciliation.** Design a DB-level operation with consistent lock protocol across receipt/reservation/checkout and audited movements; prove concurrency and reservation invariants.
- YMP-005: `bulkImportExcel` currently uses fixed organization/warehouse identifiers, writes inventory batches directly and auto-publishes new products. Its route must be replaced by a tenant-bound review/staging workflow before production catalog ingestion.
- YMP-006: audit SECURITY DEFINER RPC ownership checks, cross-tenant tests and RLS.
- YMP-007: Shopify cart queue is not evidence of POS 12-hour offline operation.
- YMP-008: no end-to-end ERP/POS/inventory/accounting transaction tests have been run during this checkpoint.
- Not checked: schema migration drift across both repositories, exact release commit, backups/restore, live user checkout, CI build, Android/Windows, 100K invoice load.
- Connected advisors reported 29 informational `rls_enabled_no_policy` findings, including deliberately private tables. Review each before treating them as vulnerabilities or incorrectly granting public access.

## Exit gates
- Run `npm test -- --run tests/billing-display.test.ts` and project typecheck/build on a checkout of this branch.
- Ensure finance UI shows a real billing record with correct period and error behavior in isolated staging; an empty table in the inspected database is insufficient.
- Do not merge until CI, security review and correct domain semantics are confirmed. Do not apply migrations to the inspected database merely to make tests pass.
- Keep catalog, financial journals, stock and client orders separate; any schema/RPC production migration requires an independently tested restore/rollback procedure.
