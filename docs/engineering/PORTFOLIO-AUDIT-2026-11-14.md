# Connected GitHub portfolio audit — 2026-11-14

> Scoped to the nine repositories visible to the connected GitHub account, **excluding VOLTA** entirely. This is a sampled repository/API/deployment audit, **not** a complete execution, code coverage certificate, or production penetration test.

## Real source of truth and verified integrations

- Primary pharmacy ERP/store source: `muslly-pharmcy/ympharma-b21a19fb`; existing `AGENTS.md` defines TanStack Start, server-only credentials, Oracle sync boundary and ERP HMAC/idempotency contract.
- GitHub squash merges were confirmed for PR **#46** (`6c83f075`), **#49** (`1b3d0329`) and **#48** (`5425572d`). The current main has 12 locally registered agent Skills, review-only catalog intake, finance/stock read-only audits, staging fixture generator, Workers Preview config and non-release Android/Windows build jobs.
- Those PR heads individually passed GitHub CI before merge; **a fresh post-merge combined-tree run is separately required**. This documentation PR exists to trigger and record that verification.
- Vercel project `ympharma` (project `prj_1rIoyVnAyhtfYWUaCwxSTsibScDU`) exposes historical deployments with metadata `githubOrg=dahsamtransport-source`, `githubRepo=pharmacy-erp`, `framework=nextjs`, `live=false`. This differs from the approved React/Vite/TanStack repository; **no domain/cutover or settings changes** until deployment provenance is reconciled.
- No hosted Cloudflare production build or real shop/ERP transaction is proven by a `wrangler deploy --dry-run`.

## Repository inventory and missing acceptance

| Connected repository | Observed role / evidence | Missing before treating as an active product |
| --- | --- | --- |
| `muslly-pharmcy/ympharma-b21a19fb` | Active TypeScript ERP/store; CI and device-build source; merges #46/#48/#49 | Hosted Cloudflare build, org-bound ERP↔store tables and migration, 2-org role/RLS tests, real purchase→FEFO→sale→journal→return cycle, reviewed medicines, 12-hour offline POS, 500-way last-item lock test, measured 100k monthly load, signed Android and hardware certification |
| `muslly-pharmcy/ympharma` | Older MUSLLY AI OS with React/TanStack, Vite and Capacitor | Establish whether any unique feature is absent in active ERP, port only one feature with tests, do not bulk-merge older lockfiles/dependencies or backend config |
| `muslly-pharmcy/Moon` | Older parallel MUSLLY UI/AI OS code and tests | Determine ownership and maintenance state, identify unique UI features, eliminate duplicated source of truth; do not push its older framework/lockfile into active ERP |
| `dahsamtransport-source/pharmacy-erp` | Generic README + engineering directives/scripts, no root `package.json` found | Clarify archival/readiness status; stop treating docs-only root as authoritative Vercel app source. Never execute legacy scripts blindly (sample `tools/apply_phase1.sh` rewrites GitHub workflows and changes Git branches) |
| `dahsamtransport-source/QuoteLLM` | French health insurance quote web app, Vercel Edge API, fixed false OCR claim via merged PR #4 | Real, consented and authenticated OCR, correct insurance policy pricing from approved contracts rather than demo formulas, secure API access and quotas, strict input size/type bounds, retention/PII logging policy, coverage and deployment smoke |
| `dahsamtransport-source/chatgpt-retrieval-plugin` | Standalone document retrieval backend with historical deprecated plugin concepts | Identify actual use case, dependency support/security, current auth and datastore permissions. Do not confuse an upstream mirror with a deployed enterprise integration |
| `dahsamtransport-source/chrome-devtools-mcp` | Chrome DevTools MCP/CLI tooling source | Use on isolated test browser with permission and version pinning; do not deploy tooling into pharmacy production servers |
| `muslly-pharmcy/everything-claude-code` | Agent prompts/hooks/skills toolkit source | Review source and licenses, select required safe skills, pin specific commits; avoid blindly executing remote hooks/commands |
| `muslly-pharmcy/demo-repository` | GitHub sample with HTML/proof workflows | No commercial product scope; exclude from ERP dependency/release graph |

The separate `oracle-modern-soft-automation` repository did not appear in the connected repositories list. No Oracle automation code or production integration was changed in this audit. It must retain its own approval/posting boundary if access is established.

## Current production Supabase observations (read-only)
Project: `ybhrmcdlgyccywpmiucz`, observed on 2026-11-14:
- `ym.products = 0`, `ym.invoices = 0`, `ym.journals = 0`, `ym.store_product_links = 0`, whereas `public.catalog_products = 27`, `public.inv_stock_batches = 15`. An empty journal cannot demonstrate a successful posting.
- Supabase security advisor: 29 RLS-enabled tables with no policy (potential intentional deny-all; **not** evidence of unauthorized access); five functions with mutable search path; six anonymous-executable `SECURITY DEFINER` public RPCs; `pg_trgm` installed in public. Review each with exact callers, function body, grant and security model before changing any production privileges. See Supabase database advisor remediation URLs.
- Legacy `drizzle/migrations/0005_erp_integration_foundation.sql` is not an approved org-bound multi-tenant schema. No automatic production migration.

## Project-independent release gates and safe remediation order

**P0 (not optional):** resolve active source-of-deploy vs Vercel/Cloudflare mismatch; review privileged RPCs and RLS on disposable staging; prove atomic financial and FEFO invariants. Observe exact deployed SHA and rollback route.
**P1:** reconcile authoritative 6,390-item import with any separate Yemen medicine atlas records; do not mistake reference prices for contracted sale/cost, or assign trial stock to real warehouse. Implement tenant-bound, versioned, HMAC-authenticated ERP store sync with reconciliation.
**P1:** implement *actual* device-granted quota-limited offline 12-hour sale journal and post-reconnect idempotent server transaction. Shopify cart localStorage is not offline POS.
**P2:** certified 30 branches × 150 cashiers performance at bursts and 100k invoices + 100k journal operations/month using real staged RPCs, with p95/p99, lock conflict and zero-loss proof.
**P2:** hardware test printer/barcode/camera, package signed Android Release, verify Windows browser/PWA and decide native installer only if needed.

## Avoid unsafe merges

- Draft PRs #29 and #30 were superseded by merged #48; #40 superseded by merged #46. Do not merge old drafts on top of current main.
- The four unique files from legacy PR #25 are now included **in this review branch**: the recorded security migration, a static regression test, a read-only catalog/store audit, and a phase 1/3 evidence note. Read-only Supabase migration history confirms version `20261111213535` is already applied; each of the five protected financial/inventory RPCs denies `anon` and `authenticated` EXECUTE but permits `service_role`. This is a source-history sync only — **do not replay this SQL in production**. The original PR #25 stays unmerged.
- Different MUSLLY repositories may have overlapping UI but distinct dependency/version histories. Port *specific* evidence-backed features via targeted PRs, **not** a monolithic repo merge.
- Account-level connected plugins/Skills do not automatically install packages or run workflows in all repositories. The main repo's registered 12 skills are guidance; each test/build/deployment must be independently observed.

## Evidence and next action
- GitHub CI for merged source is the next gate for **code integration**; full production acceptance awaits live Cloudflare logs, staging transaction fixtures, offline, load and real devices.
- No VOLTA files, repositories, databases or deployments were touched.
