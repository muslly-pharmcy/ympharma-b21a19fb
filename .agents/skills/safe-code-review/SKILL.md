---
name: safe-code-review
description: Static code and configuration review — YmPharma and muslly defensive review only
---

# safe-code-review

Read `../../../docs/security/claude-red/POLICY.md` and root `AGENTS.md` before any work; no upstream offensive scripts are permitted. Prefer existing project-specific pharma and commerce skills over this generic adapter.

## Procedure
Inspect trusted/untrusted entrypoints, database/client boundary, code/data flows, dependency and workflow risks. Cite exact repository SHA and path:line. Keep confirmed facts distinct from hypotheses.

## Evidence
Record `repo@sha:path:line | finding | status | scope | suggested safe test | remediation | approval gate`. Run only synthetic tests that do not connect to production systems. Never infer production security from static review alone.
