---
name: pharma-multitenant-transaction-audit
description: Verify tenant RLS, exact-decimal postings, FEFO and idempotent pharmacy transactions using destructive tests only in isolated staging.
---

# Tenant-bound financial transaction certification

- Inspect `ym.*` versus legacy `public.acc_*`, and the real RPC contracts. No parallel ledger, invented price, or unchecked stock fallback.
- Every read/write, line, lot, account, connection identity and idempotency key must stay scoped to a proven `org_id` and permitted warehouse or branch.
- Audit actual `SECURITY DEFINER` function definitions, grants and `search_path`; public exposure may be intentional only after input, role and row-level checks. Do not mass-revoke on production.
- Use four-place exact-decimal money; posted journals must balance and be immutable, with an audited reversal instead of deletion.
- In a disposable Supabase branch, test sale → FEFO lot → stock movement → cost entry → double-entry journal → return/reversal and a crash after each step.
- Execute 500 concurrent requests for one available unit. Accept exactly one committed sale and 499 explicit sold-out denials, zero negative quantity and no duplicate journal.
- Negative tests: cross-organization user and cashier permissions, expired/locked period, idempotent replay, lost response, expired lot, missing unit conversion and revoked device.
- Keep production reads non-destructive and report sample sizes; zero incorrect postings in an empty ledger is NOT a certificate.
