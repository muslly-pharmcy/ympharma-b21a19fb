---
name: pharma-pos-fefo
description: Verify FEFO inventory allocation and POS concurrency without overselling.
---

# POS / FEFO

- Identify existing checkout RPC and transaction boundary. Never introduce a bypass checkout path.
- Require organization, branch, cashier-shift authorization and deterministic locking.
- FEFO allocates earliest *eligible* expiry; exclude expired, recalled, blocked and unauthorized batches.
- Record lot, expiry, conversion, transaction, refund linkage and audit.
- Enforce SELECT ... FOR UPDATE (or verified concurrency equivalent) and idempotency keys.
- Validate offline quotas rather than overwriting central stock.
- Test 500 concurrent sales requests against a 1-unit item: exactly one success, 499 explicit rejections, zero overselling, with a non-production test database.
- Do not mutate real inventory or run production load tests.
