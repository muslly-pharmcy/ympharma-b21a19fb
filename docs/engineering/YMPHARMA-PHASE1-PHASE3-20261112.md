# YmPharma — Phase 1 & 3 verified baseline (2026-11-12)

**Scope:** `muslly-pharmcy/ympharma-b21a19fb`, linked Supabase `ybhrmcdlgyccywpmiucz`. Do not touch VOLTA or Oracle gateway.

## Phase 1: production database remediation

- Pre-check: 11 `public.SECURITY DEFINER` routines callable by `anon`; 181 callable by `authenticated`.
- Found five legacy accounting/inventory functions owned by `postgres` with client-supplied IDs and no `auth.uid()` / membership authorization: `acc_next_no`, `acc_post_entry`, `inv_consume_fefo`, `inv_movements_apply`, `sal_approve_invoice`.
- Applied actual Supabase migration **20261111213535** named `lock_legacy_accounting_inventory_rpcs_20261112` to remove `PUBLIC`, `anon`, `authenticated` EXECUTE and preserve `service_role`; hardened two search paths. Migration mirrored in this PR.
- Read-only post-check: **0 / 5 callable** via `anon` or `authenticated`; **5 / 5 callable** via `service_role`. Remaining overall: **6 anon and 176 authenticated** SECURITY DEFINER functions. Do **not** bulk-revoke them: classify public/allowed endpoints and test server integrations.
- No ledger rows, catalog records, balances or stock quantities changed by this migration. Database privilege verification is complete; end-to-end POS regression and staged replay tests are **not** yet complete.
- Security advisor also reports 29 RLS-enabled tables without policies (can be intentionally server-only), 5 mutable function paths, and 1 leaked-password protection setting. Review each, not blanket fixes.

Supabase remediation reference: https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0029_authenticated_security_definer_function_executable

## Phase 1: deployment source-of-truth blocker

GitHub source-of-truth approved for this work: `muslly-pharmcy/ympharma-b21a19fb` on `main`.

The connected Vercel project `ympharma` has READY deployments sourced from **`dahsamtransport-source/pharmacy-erp`**, including SHA `83a388e...`. **This is a different repository**. Do not redeploy/promote until the app source, branch, framework/build target and domain routing are reconciled and deployment pipeline smoke-tested. The GitHub repo is Vite/TanStack Start; Vercel project metadata reports framework `nextjs`.

## Phase 3: live data findings (read-only)

| Check | Verified observation |
|---|---:|
| `public.catalog_products` | 27 approved + public |
| `public.inv_stock_batches` | 15 (15 distinct product IDs) |
| `ym.products` | 0 |
| `ym.store_product_links` | 0 |
| `public.orders` | 0 |
| `ym.invoices` | 0 |
| `public.catalog_import_jobs` / `rows` | 0 / 0 |
| Missing barcodes in catalog | 27 |
| Missing generic names | 18 |
| Missing pack units | 15 |
| Missing selling_price on batch | 15 |
| Missing expiry / invalid batch quantities | 0 / 0 |

**Note:** Missing `selling_price` in the batch table does **not** establish that the store has no valid selling prices elsewhere. Do not copy regulated/official prices into retail selling-price fields.

The prior 6,390-item review dataset is **not** present in these import tables. Find and validate source records before any import. Do not set live stock to 5; use a dedicated test organization or fixture. No mutations to live catalog, prices, batches or orders in this phase.

Reusable SQL: `scripts/sql/audit_ympharma_catalog_store.sql`.

## Next acceptance gates

1. Review the remaining six anonymous SECURITY DEFINER functions and 176 authenticated functions by effective grants, callers, RLS and tenant authorization; preserve documented public search routes only if independently justified.
2. Review live CI of this PR and integration tests for POS/posting/FEFO after the legacy RPC lock; prepare a staging regression with two test organizations, out-of-stock concurrency, decimal equality, and rollback.
3. Establish deployment repository and deployment target ownership; do not implicitly move `ympharma.vercel.app` between repos.
4. Establish canonical SKU/barcode, UOM, batch mapping, price authority and ERP-store versioned sync contract. Validate with an order/settlement test before any production synchronization.
5. Reconcile import evidence for 6,390 records, deduplicate, verify clinical flags and packaging, and approve opening stock and FX policy separately.
6. Re-check Supabase security/performance advisors; do not treat informational alerts as exploitable defects by default.

## Verification status

- **PASS**: Supabase applied migration and effective execution-permission SQL checks.
- **PASS**: Read-only catalog and stock data profiling.
- **PENDING**: CI for newly-added Vitest guard and all end-to-end regressions.
- **NOT ATTEMPTED**: Production application redeploy, live store sync, catalog import, artificial stock creation, backup restore drill.
