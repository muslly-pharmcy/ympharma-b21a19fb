---
name: ruflo-dba-evidence-gate
description: Apply Aivana DBA verification and autonomy boundaries to YmPharma PostgreSQL and transactional POS changes.
---
# DBA prove-before-apply
Use for slow POS checkout, deadlocks, tenant RLS, FEFO stock races, journal balancing, migrations and indexing proposals.

- Begin with measured evidence: SQL definition, EXPLAIN (ANALYZE only on safe staging), row counts, indexes, lock and wait observations, tenant scope, performance baseline. Redact customer records and credentials.
- Grade confidence. A proposed index, query rewrite, new RPC or migration is a *hypothesis* until reproducible benchmarks and invariant checks prove it.
- Prefer a dry-run experiment on staging with rollback and backwards-compatibility gates. Aivana autonomy rules forbid autonomous real DDL or production apply.
- Protect invariants: org/branch RLS, SELECT FOR UPDATE on critical inventory, one success for a 1-unit item under 500 competing checkouts, no oversell, no double-post, immutable journal posting, exact NUMERIC(15,4) accounting.
- Run 2-sided tests: happy path and conflict/retry/rollback; distinguish serialization error from business out-of-stock rejection.
- Track recommended change, evidence strength, actual observed tests, risks, approvals, and reason for deferral. Never claim production success based on analysis.
- Do not connect an external database agent to production secrets or enable auto-apply through a skill file.
