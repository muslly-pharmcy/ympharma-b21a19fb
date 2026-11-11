---
name: pharma-ledger-integrity
description: Audit exact-decimal double-entry accounting and immutable journal integrity.
---

# Accounting integrity

- Inspect the real account/journal tables and posting paths; do not create parallel financial ledgers.
- Use NUMERIC(15,4) or an equivalent exact-decimal representation for all monetary posting calculations.
- Validate balanced debit/credit totals, period, currency, FX, rounding and branch cost center.
- Posted entries must be immutable; use audited reversals, not UPDATE or DELETE.
- Require idempotent postings and scoped authorization; reject synthetic opening balances and duplicate statement sequence numbers.
- Test partial failures, retries, duplicate invoices, period close, reconciliation, and cross-org isolation.
- Never post real entries or invent insurance settlement contract amounts.

Provide specific SQL/code evidence and reproducible invariant tests.
