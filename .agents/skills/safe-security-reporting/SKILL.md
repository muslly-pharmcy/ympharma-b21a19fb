---
name: safe-security-reporting
description: Audit reporting and retesting — YmPharma and muslly defensive review only
---

# safe-security-reporting

Read `../../../docs/security/claude-red/POLICY.md` and root `AGENTS.md` before any work; no upstream offensive scripts are permitted. Prefer existing project-specific pharma and commerce skills over this generic adapter.

## Procedure
Use evidence IDs, scope, SHA/path:line, status OBSERVATION/PASS/FAIL/BLOCKED/NOT_RUN, privacy-safe logs, severity rationale, patch, retest and sign-off. Never conflate green CI with secure production.

## Evidence
Record `repo@sha:path:line | finding | status | scope | suggested safe test | remediation | approval gate`. Run only synthetic tests that do not connect to production systems. Never infer production security from static review alone.
