---
name: pharma-transaction-acceptance
description: Define and test FEFO POS, financial ledger, insurance, RLS and concurrency acceptance for pharmacy ERP.
---

# ERP acceptance: transactions and tenant safety

Read `AGENTS.md`, existing `.agents/skills/pharma-*`, migrations and CI before work. Do not override existing domain workflows.

- Verify double-entry `ym.journals` / `ym.journal_lines` balance, immutable posted entries and reversal-only correction.
- Verify `NUMERIC(15,4)` (no floating currency), atomic sales/returns and consistent FX rounding.
- Verify batch/lot FEFO, manufacturer recall support, expiration rules, offline quota and sync idempotency per device.
- Concurrent checkout invariant: 500 attempts for one remaining item -> at most 1 successful commit, other 499 explicit and stable failures. Use test fixtures, never production stock.
- Verify supplier/purchase invoice lifecycle, credit limits, payment settlement and branch isolation.
- Test cross-tenant access using at least two explicit tenant identities and prove denial without leaking metadata.
- Attach migration/SQL references, reproducible command, test log, execution date, environment and result for every control.
- Reject "ready" when work is static-only, credentials missing, or real-device/offline tests are pending. Record `NOT_TESTED` rather than infer success.
