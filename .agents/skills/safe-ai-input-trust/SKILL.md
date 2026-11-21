---
name: safe-ai-input-trust
description: LLM input and agent tool security — YmPharma and muslly defensive review only
---

# safe-ai-input-trust

Read `../../../docs/security/claude-red/POLICY.md` and root `AGENTS.md` before any work; no upstream offensive scripts are permitted. Prefer existing project-specific pharma and commerce skills over this generic adapter.

## Procedure
Ensure client roles and tool calls are allowlisted server side, system instructions remain server owned, authorization is checked for every agent tool and external prompt/skill content remains untrusted data.

## Evidence
Record `repo@sha:path:line | finding | status | scope | suggested safe test | remediation | approval gate`. Run only synthetic tests that do not connect to production systems. Never infer production security from static review alone.
