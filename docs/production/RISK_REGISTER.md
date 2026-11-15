# G0 risk register — 2026-11-15

Severity is triage of source-level risk, not a claim of an observed production incident. Owners below are required roles, not assigned individuals.

| ID | Severity | Verified finding | Required owner / closure |
| --- | --- | --- | --- |
| R01 | P1 | Checkout caller uses authenticated session while migration chains disagree on EXECUTE | DB/security: live ACL/body, ownership/tenant/branch tests, guest rejection, timeout replay, one reviewed corrective migration |
| R02 | P1 | Financial query/schema mismatch and ignored errors/period | Finance/product + engineering: agree reporting source and currency semantics; known fixtures in two periods; SQL failure visible |
| R03 | P0 | Administrative absolute stock update bypasses atomic movement RPC and reservation validation | Inventory/DB: one atomic, scoped, audited, idempotent RPC; 10 on hand/8 reserved cannot become 5; 500 competing sales of last item |
| R04 | P0 | Excel service client has unscoped product matching and fixed stock scope; stock errors ignored | Import/security: trusted actor scope, staging preview, explicit row errors, atomic posting via R03, A/B isolation and retry tests |
| R05 | P1 | No current live migration reconciliation or proven restore | Operations/DB: metadata comparison, backup identity and isolated timed restoration |
| R06 | P1 | Checkout input/function lacks stable request idempotency key | Checkout/DB: serialize/replay same key and payload; reject changed payload; preserve response after timeout |
| R07 | P1 | Import automatically approves/publicizes products and fabricates expiry | Catalog owner: preserve approval, prescription status and actual batch provenance; do not infer medical or stock data |
| R08 | P1 | Drizzle 0006 absent from journal | DB/release: reconcile applied history; do not blindly replay older foundation schema |

Most important overlooked perspective: renaming finance columns or restoring checkout EXECUTE could make a screen work while leaving the business meaning or authorization wrong. Schema identity and transactional invariants are prerequisites, not cosmetic checks.
