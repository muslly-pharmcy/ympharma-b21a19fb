# ERP integration — protocol 2, local acceptance candidate

This describes the retained integration reconciled onto store commit 0fcb2d5f2753ee2de5f4b3bf231ca4494c9371f6. It supersedes the October 8 description of row staging and an in-memory reservation reference. No production identity, mapping, key, checkout mode or worker is activated.

## Activation and identity

Routes retain /api/public/erp/v1/* and require x-erp-protocol: 2; there is no v1 authentication fallback. All routes require ERP_SYNC_ENABLED=true, ERP_SYNC_CONTRACT_VERSION=2 and configured source/key/HMAC identities. Non-test requests require ERP_SYNC_APPROVED_DATABASE_URL to equal the resolved server database URL. Secrets remain server-only.

ERP_ORDER_FLOW_ENABLED and ERP_CATALOG_FLOW_ENABLED remain false. Order gating covers pending, ACK and reservation projections sent to /stock. Ordinary stock row staging is independent. Only an explicitly injected localOrders dependency at 127.0.0.1 permits acceptance tests. Client fields and environment flags cannot enable this dependency.

Database checkout mode is separate: erp_checkout_private.control starts as legacy. ERP mode enables review checkout; paused blocks new orders but permits status/cancellation. Returning to legacy or changing source requires terminal reconciliation. The wrapper permits legacy checkout only in legacy mode, and direct execution of the renamed legacy function is revoked. These gates do not automatically shut down every other inventory writer.

## Signing and retries

Required headers: x-erp-protocol, x-erp-key-id, x-erp-source, x-erp-timestamp, x-erp-signature and POST Idempotency-Key. The JSON source must match the signed/configured source. HMAC-SHA256 lower-case hex signs these UTF-8 fields joined with LF, without final LF:

```
ERP-MUSLLY/2
<keyId>
<source>
<integer Unix timestamp seconds>
<uppercase method>
<canonical path and query>
<request key, empty for GET>
<SHA256 of exact raw body bytes>
```

The signing window is 300 seconds. POST requires application/json, valid UTF-8, no BOM/Content-Encoding and at most 1,000,000 bytes. GET signs an empty body. Authentication precedes cached outcomes. Unique allowed cursor/limit query keys use canonical sorting and RFC3986 encoding. Aliases/trailing slashes are rejected. Retry exact bytes and key, refreshing only timestamp/signature. Non-secret shared vectors: tests/fixtures/erp-v2.json.

## Stock staging and shared request identity

The row form contains sourceSystem, sourceEpoch and rows. Row fields are row_id, erp_item_id, erp_branch_id, source_version, reservation_watermark, qty_available, unit_code, currency and optional selling_price/official_reference_price. Decimal values are strings. Cost and unknown fields are rejected.

erp_v2_apply_stock requires approved source/epoch and verified item/branch/UOM mapping. NUMERIC conversion rejects fractional base units. Selling and official-reference prices stay distinct. This form writes erp_v2_snapshots, not the website stock ledger.

Snapshots, row results and request outcomes commit together. Results distinguish APPLIED, STALE, INVALID and CONFLICT. Exact request replay returns the saved result; changed content returns409. A shared source transaction lock and cross-table checks give row and projection payloads one source/request-key identity. Request expiry tombstones require reconciliation, not automatic recreation. Row identity remains immutable across batch retries.

## Durable reservations

The projection form contains version, watermark, observed_at, rows and coverage. It is gated with order flow. Versions advance; watermark/time cannot regress. Snapshots must be fresh and row mappings verified.

Coverage requires order_id, version, state, sequence and items, with exact original items. Missing/null fields, incorrect number encodings and unknown fields are rejected. Coverage cannot disappear or regress. ACK and coverage are checked in both arrival orders, including ACKs beyond the snapshot watermark. One event version has one immutable ACK commit. A later lifecycle state, such as automatic expiry after HELD, may advance coverage at the same version. Contradictory state/version/commit copies are rejected.

erp_bridge_submit serializes reserve/cancel/expire versions. Pending events use a durable monotonic cursor. Uncovered local orders remain subtracted; ACK alone never releases stock. Covered orders are already included in the ERP net quantity and are not subtracted twice.

The original ERP counterpart uses muslly_bridge_apply/projection, native reservations and its authoritative POS snapshot under the organization lock. It rejects altered events/version gaps, persists inbox results and excludes controlled/prescription products. The original manual worker persists inbox/outbox/cursor in SQLite and supports restart after ERP commit before ACK. It is loopback-only with a public test-signing fixture, not an installed production service.

## Review checkout and catalog

Managed checkout quotes bind server prices, units, quantities, product presentation and source epoch. Submission atomically records a request/event and clears the cart. Replay is stable; changed cart/price requires requoting. Status/cancel are user-scoped. Review checkout collects no payment and does not automatically dispense or create a sale.

The catalog receiver limits changes to name_ar/description_ar. It requires mapped distinct editor/reviewer identities, current catalog.write permissions, expected revision and exact before-image. Atomic changes and approval audits are recorded; concurrent edits return a conflict. Price/cost/stock/clinical flags are outside this bridge's patch. HMAC authenticates the ERP sender; it is not two independent reviewer signatures. Upstream approval enforcement remains a separate acceptance boundary. Catalog flow is disabled by default.

## Migration order and evidence

Two migration histories exist. Reconcile deployed history before any remote push. The full isolated historical Supabase/platform schema was followed by Drizzle0000–0005, then:

- 20261008001313_erp_v2_atomic_ingest.sql
- 20261008010608_erp_durable_orders_projection.sql
- 20261008014136_erp_managed_checkout_review.sql
- 20261008023913_catalog_atomic_product_update.sql
- 20261008024930_erp_catalog_review_receiver.sql

Drizzle0004 must patch the original checkout before the later migration renames it. The forward correction 20261015001118_enforce_bridge_coverage_and_stock_request_identity.sql keeps these files unchanged and rejects unsafe existing coverage/request collisions. The separate 20261014223917 self-update/grant repair remains intact.

October15 evidence: TypeScript and full Node build passed;308 unit tests passed. Eight DB tests skipped in that unit invocation were then run separately against the full store schema:8 passed,0 skipped. Populated self-update/RLS/grant behavior passed. Bridge regressions cover missing coverage, both ACK arrival orders, commit mismatch, legitimate lifecycle transitions and both request collision directions, including two-session races. The original worker passed native hold/cancel/expiry and process-restart acceptance using an isolated ERP clone and the full store schema. Its ERP HTTP adapter uses explicit synthetic session claims and real authenticated SQL, not fresh provider JWT issuance.

Changed-file lint:0errors,18warnings. The first invocation failed because two file paths were wrong; the corrected invocation passed. Build warnings include bundle sizes/plugin timings/import behavior. Neither warnings nor skipped tests constitute production acceptance.

Before activation: confirm deployment/migration identity, complete provider/browser checkout and upstream catalog approval acceptance, establish inventory-writer ownership and operational worker/recovery ownership, add monitoring, and obtain explicit production approval. Wider database-advisor findings remain separately tracked.
