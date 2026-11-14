# YmPharma P1/P2 gate report — 2026-11-12

This pack adds **review-only** medicine import preflight, read-only finance/stock integrity SQL, and device build verification. It does not import medicine data, post accounting entries, or activate ERP synchronization.

## Catalog: source and validation

Prior local review reported **6,390** pharmacy catalog rows in a Windows database, including **2,347** records with repeating UOM descriptions / different conversion factors, **8** zero conversion factors, and **1** zero-price record. Original local data is not mounted here. Do not confuse these counts with live hosted catalog rows (27).

Run a local, non-mutating audit:
\`\`\`bash
node scripts/catalog/review-medicine-import.mjs /path/to/export.csv --out medicine-review.json
# also accepts JSON arrays and Excel (.xlsx/.xls), if existing xlsx dependency is installed
\`\`\`

For each row, report missing/ambiguous names, barcodes, unit conversions, price provenance, currency (YER/SAR/USD), prescription and controlled-drug flags. Barcodes and normalized product identities are deduplicated for human review. This is **not** clinical validation or >80% fuzzy equivalence matching; drug interchangeability can never be inferred from name similarity.

The validator intentionally sets \`safe_to_import_automatically=false\` even when basic structural checks pass. Actual production import requires two-person review, organization & branch scope, preview/diff, documented price authority, a database transaction, and independent backup.

## Accounting and stock

Use \`scripts/sql/ympharma-integrity-readonly.sql\` with a scoped **read-only** database connection. The live base at review time has 0 ERP invoices and 0 ERP journals, so \`posted_invalid=0\` is not an acceptance proof. The 15 website batches do not show negative stock.

Required staging acceptance:
- 500 competing sales against a single remaining item: exactly one successful commit, others reject predictably (no serialization leakage or negative stock).
- Full cycle: purchase with batch/expiry -> FEFO physical issue -> COGS -> double-entry -> return -> linked reversal -> cash close.
- Cross-org actor, cashier role and locked period attempts must all be rejected.
- Four-decimal ledger amounts and FX rounding history must reconcile. No arbitrary adjustment account to hide differences.
- Recompute and inspect totals from actual database transactions, not just Vitest mocks.

## ERP↔store integration blocker

The app's \`/api/public/erp/v1/*\` routes call \`erp_claim_idempotency\`, \`erp_finish_idempotency\`, \`erp_apply_stock_snapshots\` and \`erp_outbound_queue\`. Live connected Supabase currently contains **none** of these objects, although source file \`drizzle/migrations/0005_erp_integration_foundation.sql\` defines them.

**Do not apply the legacy 0005 migration unreviewed.** Its integration tables lack tenant organization scope and its admin RLS uses global role checks. A multi-tenant production implementation must bind connector identity and every snapshot, map and queue row to one verified org; grant \`service_role\` only for writes; preserve versioned authoritative price vs cost fields and reviewed FEFO reservations. Keep \`ERP_SYNC_ENABLED=false\` until staging acceptance.

## 12-hour offline requirement

The current \`src/lib/offline/cart-queue.ts\` stores Shopify cart mutations in browser localStorage. That is **not** a quota-limited offline POS sale journal. Offline sales need encrypted IndexedDB or native store, approved per-device stock quotas, stable server-side idempotency, signed device authorization, bounded device/clock expiry, physical lot rules and reconciliation on reconnection. A successful offline storefront page test is not a 12-hour POS certification.

## 100,000 invoice + 100,000 accounting operation requirement

These are monthly targets, not verified throughput. Plan workload distribution for **30 branches / 150 cashiers**, burst patterns, real database transaction concurrency, 12-hour resync backlog and peak payment/end-of-day hours. Capture p50/p95/p99, database CPU/locks, RLS performance, errors, duplicates, recovery time and audit logs. Test only against isolated staging with synthetic products and organizations. The minimum monthly arithmetic mean is irrelevant for peak load certification. Fail the release gate if any financial duplication, lost event or negative stock occurs.

## Devices

Android Capacitor project exists under \`android/\`; current version code 1 and appId \`com.ympharma.app\`. An unsigned/debug build is not a signed Android Release. Packaging and real phone camera/barcode/offline tests remain mandatory.

Windows: validate web PWA under Edge/Chrome with keyboard/RTL/barcodes before selecting native MSIX/installer packaging. No native Windows production artifact is certified.

## Release rule

No production data mutation or URL cutover unless CI, staging role tests, rollback rehearsal, full financial reconciliation, and deployment source-of-truth checks pass. Separate **code readiness**, **staging acceptance**, and **production acceptance**.
