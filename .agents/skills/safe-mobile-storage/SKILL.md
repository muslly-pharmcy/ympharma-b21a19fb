---
name: safe-mobile-storage
description: Mobile and offline data safety — YmPharma and muslly defensive review only
---

# safe-mobile-storage

Read `../../../docs/security/claude-red/POLICY.md` and root `AGENTS.md` before any work; no upstream offensive scripts are permitted. Prefer existing project-specific pharma and commerce skills over this generic adapter.

## Procedure
Review IndexedDB and service worker caches, storage namespace isolation, 12-hour quotas, device revocation, replay and offline conflict resolution. Never cache server keys or patient records in generic public caches.

## Evidence
Record `repo@sha:path:line | finding | status | scope | suggested safe test | remediation | approval gate`. Run only synthetic tests that do not connect to production systems. Never infer production security from static review alone.
