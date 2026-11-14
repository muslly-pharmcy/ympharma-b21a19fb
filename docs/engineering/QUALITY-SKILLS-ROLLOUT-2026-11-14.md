# Quality, skills and integration rollout — 2026-11-14

## Scope and evidence status
This document scopes a reviewed, non-production adoption of the suggested engineering stack. **No build, database migration, APK, load test, security scan, or deployment is proven by editing this file.** The toolkits and package versions described here are based on repository inspection as of 2026-11-14.

Already in source:
- .agents/skills/ contains agent instructions for accounting, FEFO POS, Supabase RLS, offline sync, auditing, UI and release gates. .agent-toolkit/verify.py checks the manifest.
- package.json already includes Vitest, Playwright, Capacitor, and @sentry/react. Existing CI installs with frozen bun.lock, typechecks, lints, tests, audits, builds, and dry-runs Workers.
- AGENTS.md binds Oracle traffic to /api/public/oracle-sync and ERP integration to /api/public/erp/v1/*, with HMAC, idempotency, kill switch and separate server credentials.

## Adoption boundaries
1. **Superpowers and agent skills:** use the existing repo-local skills and .github/copilot-instructions.md. Superpowers connected in ChatGPT does not mean executable code or automatic third-party installation in GitHub Actions.
2. **Context7:** optional developer documentation lookup; never required for builds. Its ChatGPT connection and repository-side tooling must be verified independently.
3. **PostHog:** NOT CONFIGURED IN APP. Design an opt-in privacy-safe event allowlist before SDK integration; avoid patient/clinical records, free-text notes, session tokens, identity fields, payment or invoice contents. Do not copy a PostHog API key from ChatGPT to a public config. Capture only approved aggregate operational metrics.
4. **Database:** use reviewed pgTAP regression coverage in a disposable Supabase branch; never run schema migrations or test financial postings against production.
5. **Load:** write k6 scenarios for 500 concurrent purchases against one unit (one succeeds, 499 receive explicit rejection), and 100,000 invoices + 100,000 accounting operations per month; require observed traces, latency, RLS and audit coverage. Do not use artificial success criteria.
6. **Browser and OS:** use existing Playwright and Capacitor before adding new UI/browser/mobile frameworks. Choose Tauri for Windows only after validating desktop requirements and storage strategy; do not make a second inventory ledger.
7. **Security:** keep locked dependency audit in CI; evaluate Semgrep/Trivy in report-only trial before making them mandatory. Protect supply chain and avoid floating workflow action refs.
8. **Web:** run Lighthouse against public pages and verify SSR indexing, robots/canonical, redirects, 404s and sitemap; never persist private authenticated API data.
9. **OCR:** Oracle Modern Soft Automation is a separate repository/approval boundary. Do not post accounting transactions from OCR results without explicit human approval.

## Required release evidence (not yet rerun for this plan)
- [ ] CI on the new branch: tool-kit verification, TypeScript, ESLint, Vitest, production build, Cloudflare dry-run, browser smoke.
- [ ] Replay-safe finance and FEFO database tests and negative tenant isolation checks.
- [ ] Twelve-hour offline sale + reconnect + duplicate-replay test on physical devices with quotas.
- [ ] Load test traces and rejection taxonomy; 100k monthly capacity evidence.
- [ ] Privacy and security review before any PostHog event or new dependency.
- [ ] Security scan and dependency change review.
- [ ] Rollback plan and explicit approval before merge, publish, schema change or live financial action.

## Priority
P0 production CI and transaction invariants; P1 offline/device and ERP-store reconciliation; P2 observability, UI/performance and optional packaging.

## What this branch actually changes
Toolkit check now runs on pushes to main. Developer guidance adds test-first, no-claims-without-evidence and telemetry privacy rules. Public README no longer advertises demo admin credentials. All new integrations are proposals until separately coded and tested.
