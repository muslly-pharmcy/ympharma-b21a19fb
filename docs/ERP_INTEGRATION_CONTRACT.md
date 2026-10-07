# YmPharma ERP ↔ muslly.com — Integration Contract v1 (test stage, live OFF)

## Topology
ERP stays on the local network. A Windows agent next to ERP opens **outbound HTTPS only** to
`https://muslly.com/api/public/erp/v1/*`. The website never calls into the LAN; ERP DB is never exposed.

## Source of truth
ERP owns selling price and available stock. The website stores versioned snapshots in
`erp_stock_snapshots` and never edits ERP ledgers. Prices are separate: `selling_price`,
`official_reference_price`, `purchase_cost` (internal), with `currency` (YER/SAR/USD) and `unit_code`.

## Auth (every request)
| Header | Value |
|---|---|
| x-erp-timestamp | unix seconds (±300s) |
| x-erp-signature | hex HMAC-SHA256(ERP_SYNC_HMAC_SECRET, `ts.METHOD.path.sha256hex(body)`) |
| Idempotency-Key | unique per logical request (POST only, 8–200 chars) |

## Endpoints
| Method | Path | Body / Result |
|---|---|---|
| POST | /stock | `{sourceSystem, rows:[{erp_item_id, erp_branch_id, source_version, qty_available, unit_code, selling_price?, official_reference_price?, purchase_cost?, currency}]}` → `{received, applied, stale, invalid}` |
| GET | /orders/pending?after=ISO | `{orders:[{order_id,payload,status,created_at}], next}` |
| POST | /orders/ack | `{orderId, status: received|accepted|rejected}` — records ERP decision only |
| GET | /reconcile | `{rows:[item, branch, version, qty, unit, price, currency]}` |

## Rules
- Same key + same body → stored response replayed (`replayed:true`). Same key + different body → **409**.
- `source_version` must strictly increase per item+branch; older/equal → counted `stale`, logged in `erp_sync_conflicts`.
- Invalid rows are rejected individually (partial batch allowed, each logged).
- Unknown units are rejected, never guessed.
- `ERP_SYNC_ENABLED` ≠ `true` → every endpoint returns 503 without writing.
- No dispensing, medical approval, or payment is ever auto-confirmed.

## Pending from ERP
API vs read-only DB access; item/branch/unit IDs and pack factors; a monotonic version or
last-modified per item+branch; always-on agent PC; approval of a new HMAC secret.
