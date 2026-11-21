---
name: safe-api-authorization
description: API/RPC object authorization and Supabase RLS — YmPharma and muslly defensive review only
---

# safe-api-authorization

Read `../../../docs/security/claude-red/POLICY.md` and root `AGENTS.md` before any work; no upstream offensive scripts are permitted. Prefer existing project-specific pharma and commerce skills over this generic adapter.

## Procedure
Audit org_id and branch_id scoping, client auth, permission checks, SECURITY DEFINER search_path/grants and anon/public RPCs. Propose isolated synthetic negative tests; never probe production.

## Evidence
Record `repo@sha:path:line | finding | status | scope | suggested safe test | remediation | approval gate`. Run only synthetic tests that do not connect to production systems. Never infer production security from static review alone.
