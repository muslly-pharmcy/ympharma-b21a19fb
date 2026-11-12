# YmPharma ERP ↔ muslly.com — v2 tenant-isolated foundation (2026-11-12)

**Status: implementation review, NOT deployed or live-enabled.**
Target source repo: \`muslly-pharmcy/ympharma-b21a19fb\`. Production Supabase ref: \`ybhrmcdlgyccywpmiucz\`.

## Why a second contract

The live database lacks the legacy v1 ERP RPCs and \`erp_outbound_queue\`, even though \`drizzle/migrations/0005_erp_integration_foundation.sql\` exists in GitHub. That historical SQL has global mappings and idempotency keys without organization columns; don't apply it to a multi-tenant production system.

The v2 code and SQL intentionally coexist with v1 and are **disabled by default**. No historical rows are migrated, and no production physical stock, prices, batch expiry, orders, payments or journals are modified by this PR.

## Tenant + caller trust

- Every endpoint starts with \`/api/public/erp/v2/\` and requires \`ERP_SYNC_V2_ENABLED=true\`. Otherwise it returns HTTP 503.
- Server-only environment: \`ERP_SYNC_V2_ORG_ID\` (one active organization's verified UUID) and \`ERP_SYNC_V2_HMAC_SECRET\` (at least 32 characters, random and unique per connector). The website never exposes this secret to the frontend.
- The connector sends \`x-erp-organization-id\`, \`x-erp-timestamp\`, \`x-erp-signature\` and for POST \`idempotency-key\` (16–128 safe characters).
- HMAC-SHA256 signs JSON-array encoding of: \`['ympharma-erp-v2', timestamp, UPPERCASE_METHOD, exact_path_and_query, organization_id_lowercase, idempotency_key, SHA256(exact_body)]\`.
- Request is rejected if the signed organization differs from the server-configured organization, even if the signature was created with the same secret.
- GET paths also bind query text. A POST with query parameters is refused; reusing a signature under a different idempotency key, route, method, payload, time window or organization is refused.
- **One organization per configured backend identity**. For multiple organizations, deploy independent connector identities or add a reviewed per-organization key resolver. Do not share one global secret across tenants.

## Staging SQL + test instructions

\`drizzle/migrations/0006_erp2_org_scoped_foundation.sql\` creates independent \`erp2_*\` objects, with \`org_id\`-scoped keys and FKs. All tables have RLS enabled and browser role grants removed. RPCs use \`SECURITY INVOKER\` with EXECUTE limited to \`service_role\`.

Run the \`ERP v2 tenant-isolation PostgreSQL integration tests\` GitHub workflow: disposable PostgreSQL 16 creates synthetic tenants, applies **only** \`0006\`, then tests real SQL invariants:
- same SKU shared across two organizations without stock crossover;
- invalid, foreign, unpublished or unmapped product rejected;
- negative quantities and greater-than-four-decimal prices rejected;
- version monotonically increasing; stale versions ignored;
- replay, conflict and in-progress semantics for org/key idempotency;
- no \`anon\` or \`authenticated\` privileges on ERP2 tables and RPCs;
- actual \`service_role\` can inspect the permitted data.

It does not test hosted RLS using a real signed-in cashier or a production ERP: those remain acceptance gates.

## Integration workflow

Current v2 routes:
- \`POST /api/public/erp/v2/stock\` — rows with canonical external item+branch, integer source version and exact **string** decimals; records a versioned web-facing **snapshot only**.
- \`GET /api/public/erp/v2/reconcile\` — tenant-filtered authorized stock and retail/reference pricing.
- \`GET /api/public/erp/v2/orders/pending?limit=50\` — a tenant-filtered review queue. **No automatic order producer exists in v2 yet.**
- \`POST /api/public/erp/v2/orders/ack\` — records receipt/accept/reject without invoicing, dispensing or payment.

Retail \`selling_price\` and \`official_reference_price\` are independent. **Purchase cost is not in this connector contract.** All stock snapshots are disconnected from actual \`inv_stock_batches\` until an approved, double-entry-consistent allocation/FEFO design is tested. This prevents a remote ERP from overwriting warehouse on-hand stock.

All \`catalog_products\` used in mapped snapshots must be **explicitly assigned to the same organization**, approved and public. Global/unowned catalog products are rejected. This matters on the current live project: 15 of 27 catalog rows currently have NULL \`organization_id\`; they must not be blindly mapped.

## Release blockers

1. Source-authoritative reviewed mapping of the 6,390 local medicines, real branch/warehouse identities and price policy; no default quantity 5 in production.
2. Organization-verified producer from site checkout to \`erp2_outbound_queue\` with a PII-minimized, versioned payload. Existing \`orders.id\` is TEXT, not UUID.
3. Staged two-tenant **authenticated RLS** tests, approved source catalog and ERP cashier/warehouse roles. The CI SQL fixture tests only the connector database contract.
4. Retry/outbox reconciliation on power/network loss and ambiguous writes; no automatic replay when state is \`in_progress\`.
5. Staged purchase → FEFO → sale → return → ledger/closing, 500-way stock contention test and 12-hour offline POS test.
6. Database backup/restore, secret rotation, branch/domain and Cloudflare/Vercel source-of-truth approval.
7. Only after these: decide on applying 0006 to a supported **non-production Supabase branch** and enabling the v2 kill switch in that environment. No live secrets, domain routing or production stock changes are part of this PR.

## Reconciliation pagination

GET /api/public/erp/v2/reconcile accepts only offset (default 0) and limit (1–500, default 500). Sign the full path and exact query on every request. The response retains organizationId and rows and adds pagination: offset, limit, total, hasMore, nextOffset. Continue with nextOffset until null; never assume one response is the complete catalog. Each page uses exact tenant-filtered count and stable item/branch ordering. The next offset advances by the returned row count, including when the database's configured cap is smaller than the requested page size. Missing counts, failed queries and unexpectedly empty intermediate pages fail visibly.

This is a live ordered view, not a transactionally consistent snapshot: pause mapping changes during a full comparison or repeat the pass and reconcile source versions. These pages contain retail snapshots only; the connector is still disabled by default. The regression suite traverses 6,390 synthetic rows under a 200-row server cap; it does not validate or import the original medicine dataset.
