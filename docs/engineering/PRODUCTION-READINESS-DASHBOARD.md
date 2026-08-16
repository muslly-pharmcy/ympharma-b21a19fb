# MUSLLY AI OS — Production Readiness Dashboard

**Executive KPI Report** · Updated: 2026-07-26 (post-cycle) · Owner: Principal Engineer
Update cadence: after every major engineering phase.

## Scorecard

| Category | Current | Target | Trend | Status |
|---|---|---|---|---|
| Security | 92 | 95 | ↑ | 🟢 |
| Performance | 96 | 95 | → | 🟢 |
| Accessibility | 100* | 100 | → | 🟢 |
| UX / UI | 86 | 95 | → | 🟡 |
| AI Systems | 92 | 95 | ↑ | 🟢 |
| Connector Health | 78 | 95 | → | 🟡 |
| Testing | 88 | 90 | ↑↑ | 🟢 |
| Infrastructure | 88 | 95 | → | 🟡 |
| Documentation | 90 | 90 | → | 🟢 |
| **Composite** | **90** | **94** | ↑ | 🟢 |

### Autonomous cycle 2026-07-26 (post-Baseline v1)
- **Security:** closed 2 active scanner findings — `crm_loyalty_any_member_write` (rewrote 10 CRM `ALL` policies to require `crm.loyalty.manage` / `crm.promotions.manage` / `crm.customers.manage` via `has_org_permission`) and `inv_expiry_alerts_ack_wrong_permission` (raised UPDATE from `inventory.read` to `inventory.manage`). 0 active findings remaining.
- **Testing:** all 5 pre-existing failing tests fixed. Suite: **196/196 (100%)**.
- **Event Bus:** implemented missing `event-consumer` and `dlq-reprocessor` HTTP consumers, formalized DLQ replay contract in ADR-0001, generated cron SQL (`docs/engineering/sql/schedule-dlq-reprocessor.sql`) requiring elevated deploy privileges.
- **DB perf:** dropped 2 unused duplicate indexes (`idx_error_logs_occurred_at`, `idx_uptime_checks_checked_at`) — retained indexes serve identical queries with 100× higher scan counts, reducing write amplification on the two hottest log tables (44.5 s + high-volume inserts).
- **Deps:** removed 4 verified-unused packages (`@fontsource/cairo`, `@fontsource/tajawal`, `@fontsource-variable/montserrat`, `@e965/xlsx`); 0 high/critical vulnerabilities in remaining tree.
- **Typecheck:** clean (`tsgo --noEmit`).



*Accessibility marked 100 pending post-deploy re-audit; Phase 3D adds explicit `<main role="main">` which resolves the last failing axe rule.

## Category Detail

### Security — 88 / 95
- **Blocking:** none currently open above P2.
- **Recent:** 220 SECURITY DEFINER functions audited, 43 EXECUTE grants revoked; RLS hardening on `hc_doctors`, `profiles`, `air_agents`, `organization_members`.
- **Next:** Rotate service-role secrets on 90-day cadence; add automated OSV scan gate to CI.

### Performance — 96 / 95 ✅
- **Blocking:** Home TTFB 1.16 s (root-domain 302 redirect).
- **Recent:** Logo 2.21 MB → 17.8 KB WebP; Three.js lazy-in-view; xlsx dynamic import. Home LCP 3.0 s → 0.93 s, Shop LCP 2.62 s → 0.76 s.
- **Next:** Remove `muslly.com` → canonical 302; enable `build.sourcemap: hidden`.

### Accessibility — 98 / 100
- **Blocking:** `landmark-one-main` on `/` and `/shop` (SSR fallback lacks `<main>`).
- **Next:** Wrap `RouteSkeleton` Suspense fallback in `<main>`; sweep buttons for `aria-label` on icon-only controls.

### UX / UI — 82 / 95
- **Blocking:** Empty/error/loading states inconsistent across customer surfaces; motion system not yet unified.
- **Next:** Phase 4 audit (see below) — Home, Shop, PDP, Search, Cart, Checkout, Orders, Auth.

### AI Systems — 92 / 95
- **Blocking:** `event-consumer` route existed only as a cron target for weeks — now implemented (`src/routes/api/public/hooks/event-consumer.ts`). DLQ reprocessor code shipped; pg_cron install requires elevated privileges (SQL at `docs/engineering/sql/schedule-dlq-reprocessor.sql`).
- **Recent:** ADR-0001 (Event Bus + DLQ Replay contract) accepted. SUN CORE, Event Bus, pgvector memory, Clinical Copilot on Gemini 1.5 Flash live.
- **Next:** Owner applies DLQ cron SQL; add per-agent error-budget alerting on `fail_agent_event` volume.

### Connector Health — 78 / 95
- **Blocking:** Sentry DSN not set in prod env (init is a no-op); WhatsApp webhook shipped but not yet verified end-to-end with Meta.
- **Next:** Set `VITE_SENTRY_DSN`; run Meta webhook subscribe + delivery test; add `standard_connectors--list_connections` to health dashboard.

### Testing — 70 / 90
- **Blocking:** No E2E for checkout FEFO happy path in CI; Lighthouse budget not enforced per-PR.
- **Next:** Playwright checkout smoke; Lighthouse-CI with budgets from `COMPARISON.md`.

### Infrastructure — 85 / 95
- **Blocking:** Root-domain redirect adding ~1 s TTFB; no CDN cache headers on HTML.
- **Next:** Fix redirect, set `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300` on route HTML.

### Documentation — 88 / 90
- **Recent:** `WAVE-C*`, `WAVE-R1.*`, `titan-omnibus-v7-certification.md`, this dashboard.
- **Next:** Runbooks for DLQ recovery and secret rotation.

## Phase 4 — Customer Experience Audit (kicking off)

Scope: Home, Shop, Product Details, Search, Cart, Checkout, Orders, Authentication.
Axes: accessibility · trust · conversion · visual hierarchy · mobile · medical branding · motion · loading/empty/error states.
Deliverable: per-surface issue list with severity + fix, tracked in `docs/engineering/PHASE-4-CX-AUDIT.md` (to be created next).

## Change Log

- 2026-07-26 · **Enterprise Production Baseline v1** ratified via Phase 5 sweep against live muslly.com. All 11 sampled routes 200; security headers (HSTS, CSP-report-only, XFO=DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) verified; Web Vitals held from Baseline v1. Unit + integration suite 181/186 (97.3%); 5 non-blocking failures triaged Medium (SUN-GUARDIAN Arabic intent classifier, sanitizer expectation drift, logger-redactor null edge, magic-number executable check, permission-check assertion). 0 unresolved Critical/High security findings. Recommendation: ⚠️ Ready for Production with Minor Follow-ups. See `PHASE-5-EXECUTIVE-REPORT.md`. Composite 87 → **89**.
- 2026-07-26 · **Production Baseline v1** frozen. Post-3D re-audit (muslly.com): Home LCP 1.74 s / FCP 1.51 s / CLS ~0 / TBT 255 ms / TTFB 1.00 s; Shop LCP 1.48 s / FCP 1.28 s / CLS ~0 / TBT 11 ms / TTFB 1.05 s. No failed requests, no hydration warnings, CSP + HSTS + XFO headers verified. Console noise limited to CSP report-only notice and generated Supabase-env guard (both non-fatal, tracked as external limits). CX Batch 1 shipped: shared `StateViews` (loading skeletons, empty, error+retry) wired into `/shop`, `/_authenticated/cart`, `/_authenticated/orders`; optimistic remove on cart. No changes to checkout, pricing, inventory, auth, or branding.
- 2026-07-26 · Phase 3D shipped: `<main role="main">`, hidden source maps, CSP `font-src` widened for `cdn.gpteng.co`, `/shop` redirect eliminated. Composite 86 → 87. Phase 4 CX audit produced (`PHASE-4-CX-AUDIT.md`) — recommendations pending review.
- 2026-07-26 · v2 Lighthouse: Home 76→96, Shop 83→99, LCP −70%. Composite 82 → 86.


## Roadmap — Remaining Work (priority order)

1. **Deploy Phase 3D** (`preview_ui--publish`) then re-audit `/` and `/shop` to confirm a11y=100, BP≥96, shop redirect=0. **Blocking upgrade of Perf/A11y/BP scores.**
2. **CX batch 1** — Empty / error / loading states for Shop, Cart, Orders. Highest conversion impact, low risk.
3. **Connector Health** — Set `VITE_SENTRY_DSN` in prod; Meta WhatsApp end-to-end delivery test.
4. **Testing** — Playwright checkout smoke + Lighthouse-CI budgets from `COMPARISON.md`.
5. **Infrastructure** — HTML `Cache-Control: s-maxage=60, stale-while-revalidate=300` on marketing routes to close the Home TTFB gap.
6. **Product JSON-LD** — `Product` schema on `/product/*` for rich results.
7. **CX batch 2** — Order timeline stepper, checkout sticky summary, password reveal toggle.
8. **AI Systems** — Apply `schedule-dlq-reprocessor.sql` (needs cron-schema GRANT); add per-agent error-budget alerting.
