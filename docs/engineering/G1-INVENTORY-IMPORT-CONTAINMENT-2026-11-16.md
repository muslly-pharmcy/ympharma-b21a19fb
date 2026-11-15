# G1 containment: eliminate bypassing stock and Excel imports
Date: 2026-11-16. Changes **code only** on review branch; no production SQL, checkout or stock mutation.

## Why this intervention
- `setProductStockBalance` previously calculates a product-wide total from multiple batches and writes rows one by one. It can violate reserved stock, miss concurrent inserts and omit movement audit records.
- `bulkImportExcel` previously used a fixed organization and warehouse, imported approved/public products and updated `inv_stock_batches` directly, including unchecked errors.
- `withIdempotency` currently checks the key and writes its response *after* completing the side effect. This does **not** guarantee exactly-once execution under concurrency.

## Implemented here
- Legacy absolute balance endpoint now fails closed after an actor permission check. Its admin UI no longer permits balance editing or initial stock seeding.
- Excel import inserts **new** tenant-bound `catalog_products` only, marked `pending_review`, `is_public=false`, `requires_prescription=true` pending classification; no `sbdma_official_price` write.
- Candidate price and quantity are review proposals only, saved in `metadata.excel_review`; no stock batch is created or updated.
- Existing catalog codes are skipped, not overwritten. Unique constraint violations are reported and do not affect other organizations.
- The UI sends at most 200 rows per request, aggregates counts, and explicitly explains non-atomic partial completion and deferred quantity review.
- Automated guards prevent reintroduction of unsafe stock writes or auto-publication via this import route.

## Limitations / remaining engineering work
**This is a safety containment, not completion of YMP-004/YMP-005.** The normal absolute stock setting is intentionally unavailable until a new product/warehouse-scoped atomic adjustment RPC is implemented with audited inventory movements, reservation-safe locks, and exactly-once idempotency. Direct batch-adjust RPC safety should be audited across all callers.

Excel approval workflow remains separate; any approval must validate clinical classification, price currency, barcode, supplier, batch, expiry, stock receiver and role/branch constraints. The catalog currently has both global and tenant-specific unique indexes on store_code; collisions across organizations remain possible until a planned schema migration.

The review-only import is intentionally per-row, not all-or-nothing; batches may partially complete and return detailed skipped rows. Repeated uploads skip existing codes. It does not yet record a durable import-job ID or a transaction-wide audit entry. Before applying to production, test against representative staging data and confirm the review queue and catalog access policies.

## Acceptance before merge
- Full CI typecheck/lint/unit tests/node+Cloudflare builds.
- Staging: role/tenant tests, existing-code replay, global collision test, 200+ batch replay and source data review.
- Confirm no product in import can become publicly listed without separate clinical approval.
- Confirm no `inv_stock_batches` write, official price update, or financial journal posting occurs.
- Test existing admin product-add without stock; verify users see clear guidance.
- Keep separate PR #64 finance changes isolated; do not deploy either PR to production without review and staged tests.
