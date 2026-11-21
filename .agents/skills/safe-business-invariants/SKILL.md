---
name: safe-business-invariants
description: Financial and inventory invariants — YmPharma and muslly defensive review only
---

# safe-business-invariants

Read `../../../docs/security/claude-red/POLICY.md` and root `AGENTS.md` before any work; no upstream offensive scripts are permitted. Prefer existing project-specific pharma and commerce skills over this generic adapter.

## Procedure
Map NUMERIC(15,4) journal balancing, immutable postings, FEFO, order pricing from server, RLS and idempotent cart checkout. 500-concurrent-request stress tests only in a disposable database with explicit test authorization.

## Evidence
Record `repo@sha:path:line | finding | status | scope | suggested safe test | remediation | approval gate`. Run only synthetic tests that do not connect to production systems. Never infer production security from static review alone.
