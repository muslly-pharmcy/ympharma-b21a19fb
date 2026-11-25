---
name: ympharma-video-qa
description: Verify YmPharma accounting, FEFO inventory, RTL interfaces, offline replay and release readiness on isolated data.
---

# YmPharma QA

Inspect package.json and existing AGENTS.md, test fixtures and CI before executing. Existing commands verified in package.json on main on 2026-11-25: bun run test, bun run test:e2e, bun run lint, bun run check:secrets, bun run validate:cloudflare, bun run build:cloudflare and bun run build:android. Check test environment isolation before running any command. Do not install unnecessary dependencies or start deployment.

Verify balanced immutable journals, decimal monetary precision, tenant permissions, FEFO and locked inventory. On an isolated fixture exercise 500 simultaneous purchases of a single item; exactly one succeeds, others must fail safely. Test 12-hour offline quotas and replay idempotency. Measure synthetic monthly workload equivalent to 100,000 invoices and 100,000 accounting operations; report throughput, latency and errors, not an unsupported capacity claim.

Use Playwright for Arabic RTL, keyboard invoice entry, mobile viewport and role-specific access. Android currently uses Capacitor; do not introduce Expo without an architecture decision. Independently review the evidence and record pass/fail/blocked with commands and artifacts. No production changes or live financial transactions.
