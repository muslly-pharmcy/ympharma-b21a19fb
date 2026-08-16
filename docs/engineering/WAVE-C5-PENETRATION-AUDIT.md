# TITANUS OMEGA ULTRA — Wave C.5

## Enterprise Penetration & Architecture Verification

- **Mode:** Read-only. No file, config, schema, or dependency was modified.
- **Deliverables per finding:** Evidence · Severity · Impact · Likelihood · Recommendation · Regression Risk · Priority.
- **Scope:** Web, AI, Database, Server, Frontend, Dependencies, Infrastructure, AI Runtime, Enterprise Architecture, Performance.
- **Rule adopted (WAVE-C-1.5 §Constitution amendment):** No automatic fixes during audits. All fixes ship in Wave C.6 under a separate `GO`.

Severity scale: `CRITICAL / HIGH / MEDIUM / LOW / INFO`.
Likelihood: `Very High / High / Medium / Low / Very Low`.
Priority: `P0 (block release) · P1 (before public launch) · P2 (next sprint) · P3 (backlog)`.

---

## 0. Executive Summary

| Score | Value | Rationale |
|---|---|---|
| **Security Readiness** | **62 / 100** | Auth, RLS, headers, redirect hardening, and CSP baseline are in place. Losses: live client-bundle env leak → runtime crash on `/`, no rate limiting on public POSTs, dead-stub `SecurityModule` misrepresents controls, module-scoped env reads across AI runtime. |
| **Architecture Health** | **71 / 100** | Clean domain/command/schema layering, kernel is the sole AI orchestrator, boundaries respected between `.functions.ts` and `.server.ts`. Losses: two page trees (`src/pages/*` vs `src/routes/*`), duplicated Supabase-env envelopes, unused hardcoded UI fixtures. |
| **AI Governance** | **74 / 100** | Kernel + Policy + Budget + Prompt Registry + Capability RBAC exist end-to-end. Losses: no runtime attestation that `Kernel.dispatch` is the only path to the gateway (nothing forbids callers from importing `gateway.server.ts` directly); Decision Records lack tamper-evident hashing. |
| **Performance Readiness** | **58 / 100** | Suspense + skeletons + code-split routes shipped. Losses: no virtualization on `catalog`/`patients`/`doctors` lists; framer-motion + three.js + drei + postprocessing ship a heavy client bundle; no LCP/INP telemetry. |
| **Enterprise Readiness** | **60 / 100** | Constitution, domain schemas, migrations, CSP report sink, error taxonomy. Losses: no CI gates enforcing lint/type/test on PRs beyond local hooks; no DR runbook; no rate-limit or WAF; observability is `console.warn`-only for CSP + errors. |

### Production Decision

> **GO WITH CONDITIONS.**
> Block release until every **P0** finding below is remediated in Wave C.6.
> Once P0s clear, public soft-launch is acceptable while P1s land in a follow-up sprint.

---

## 1. Critical Blockers (P0)

### F-01 — Live runtime crash: Supabase env vars unresolved on client bundle
- **Category:** Web / Infrastructure / Frontend hydration.
- **Evidence:** Browser console (`2026-07-20T21:22:46Z`) on `/` preview URL:
  > `Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY. Connect Supabase in Lovable Cloud.`
  Thrown from `src/integrations/supabase/client.ts:36–41`, which reads `import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL`. The published bundle has neither — Vite substitutes `import.meta.env` only for values prefixed `VITE_` **at build time**, and `process.env.*` is `undefined` on the client. React error boundary at `__root__/` catches it; the app renders the error screen on every load.
- **Severity:** CRITICAL. **Likelihood:** Very High (deterministic on cold load). **Impact:** Full app unavailability for every anonymous visitor.
- **Recommendation:** Guarantee `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are injected at build time (Lovable Cloud provides these); remove the `process.env.*` fallback from the client module so the failure mode is a hard build error rather than a runtime blank page. Simultaneously reject building the client bundle if either is missing.
- **Regression Risk:** Low. The current fallback is already inert on the client.
- **Priority:** **P0.**

### F-02 — `_authenticated` route uses `ssr: false` and executes auth check in the browser
- **Category:** Web / Authorization / SSR.
- **Evidence:** `src/routes/_authenticated/route.tsx:5` — `ssr: false` + `beforeLoad` calls `supabase.auth.getUser()`. Any protected sub-route (`/catalog`, `/dispenses`, `/prescriptions`, …) renders **no SSR shell**, so the initial HTML is empty; unauthenticated redirect happens client-side after JS boots.
- **Impact:** (a) A user with a broken JS bundle sees blank page instead of a redirect. (b) Cache/CDN cannot pre-render the shell. (c) Combined with F-01, protected pages have double failure paths.
- **Severity:** HIGH. **Likelihood:** High.
- **Recommendation:** Perform the token check server-side (`getRequest()` + Supabase cookie parsing) inside `beforeLoad`, keep SSR on, and rely on `requireSupabaseAuth` at each `createServerFn` for defense-in-depth. Client redirect stays as fallback.
- **Regression Risk:** Medium — every protected route becomes SSR-eligible; verify no browser-only globals leak into loaders.
- **Priority:** **P0.**

### F-03 — Public POST endpoints have no rate limiting or global body cap
- **Category:** API / Infrastructure.
- **Evidence:** `src/routes/api/public/csp-report.ts` caps at 16 KB but has no per-IP throttle. No shared middleware enforces bytes/RPS across public routes. `rg -n "rate.?limit|throttle" src/lib src/routes/api` returns only error-classifier hits. Historical `public-endpoint-guard.server.ts` referenced in previous waves is not currently invoked from any public route.
- **Impact:** A single client can spam `/api/public/csp-report` with 16 KB bodies indefinitely, filling log storage and CPU.
- **Severity:** HIGH. **Likelihood:** High (public, unauthenticated).
- **Recommendation:** Reinstate `public-endpoint-guard.server.ts` as request middleware on every route under `src/routes/api/public/*` with (a) IP-hash cooldown, (b) global 16 KB cap enforced pre-parse, (c) shared user-agent allow/deny list.
- **Regression Risk:** Low.
- **Priority:** **P0.**

---

## 2. High Priority Issues (P1)

### F-04 — `SecurityModule.tsx` misrepresents live security posture
- **Category:** Frontend / Governance.
- **Evidence:** `src/modules/security/SecurityModule.tsx:9–32` renders hardcoded strings (“RLS: مفعل”, “2FA: مفعل للأدمن”, “Audit Log: يسجل”, fake users, static audit-log rows). None of these are wired to real data.
- **Impact:** Any operator viewing this dashboard receives a false green signal, contradicting the "Evidence-based" constitution.
- **Severity:** HIGH (governance risk, not exploit). **Likelihood:** Very High (any admin viewing).
- **Recommendation:** Either (a) remove the module from routing until backed by `air_*` / `audit_*` tables, or (b) drive every tile from a `createServerFn` reading real state (RLS enabled count from `pg_policies`, 2FA from `auth.mfa_factors`, audit from `audit_log`).
- **Regression Risk:** Low.
- **Priority:** **P1.**

### F-05 — Two parallel page trees (`src/pages/*` and `src/routes/*`) with unreachable pages under `/pages`
- **Category:** Architecture / Dead Code.
- **Evidence:** `src/pages/AIChat.tsx`, `MissionControl.tsx`, `SolarSystem.tsx`, `PlanetPage.tsx` exist. TanStack Start file-routing lives in `src/routes/*` (`ai-chat.tsx`, `mission-control.tsx`, …). Some `src/routes/*` files import from `src/pages/*` — the reverse duplication makes it easy to add a page under `src/pages/` that is never routed.
- **Impact:** DRY violation; risk of future engineers editing the wrong file; typecheck cost.
- **Severity:** MEDIUM (architecture). Elevated to P1 because the constitution names this pattern explicitly.
- **Recommendation:** Inline each `src/pages/*` module into its owning `src/routes/*` file (or convert to a `src/components/*` component if reused), then delete `src/pages/`.
- **Regression Risk:** Low.
- **Priority:** **P1.**

### F-06 — `.env.example` documents fictional envs (WhatsApp, Razorpay, OpenAI, Google Maps, quantum-memory flags)
- **Category:** Documentation / Supply Chain / Secrets Hygiene.
- **Evidence:** `.env.example` lines 6–33 list `VITE_OPENAI_API_KEY`, `VITE_WHATSAPP_API_TOKEN`, `VITE_RAZORPAY_KEY`, `VITE_ENABLE_QUANTUM_MEMORY`, etc. None are read anywhere in the code (`rg` confirms).
- **Impact:** Onboarding engineer will paste real secrets into `VITE_*` variables — every one of those would be **shipped to the browser bundle**. This is a foot-gun.
- **Severity:** HIGH.
- **Recommendation:** Rewrite `.env.example` to the real set: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and server-only `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`. Add a red-boxed comment banning secrets under `VITE_*`.
- **Regression Risk:** Zero.
- **Priority:** **P1.**

### F-07 — Legacy `inventory.functions.ts` opens without `requireSupabaseAuth`
- **Category:** Server / Authorization.
- **Evidence:** `rg -L requireSupabaseAuth src/lib/*.functions.ts` reports `src/lib/inventory.functions.ts` explicitly with a TODO ("switch to `requireSupabaseAuth` once real Supabase Auth is wired in"). This is now wired.
- **Impact:** Unauthenticated callers can invoke every exported inventory server function on the published site.
- **Severity:** HIGH. **Likelihood:** Medium (endpoint URLs are hashed but discoverable in the client bundle).
- **Recommendation:** Attach `requireSupabaseAuth` on every exported `createServerFn` in `inventory.functions.ts`; delete the TODO. Verify the mutations file too.
- **Regression Risk:** Low — the middleware is used everywhere else.
- **Priority:** **P1.**

### F-08 — CSP still allows `'unsafe-inline'` on `script-src`; no runtime attestation of enforcement flip
- **Category:** Web / CSP.
- **Evidence:** `src/lib/security/headers.server.ts:37`. Documented deferral is legitimate, but nothing tracks the graduation path.
- **Impact:** In Report-Only, no protection at all; on flip, without nonces the policy would break the app.
- **Severity:** MEDIUM. Elevated to P1 because it blocks the CSP graduation milestone.
- **Recommendation:** Add a CI check that fails if `Content-Security-Policy` (enforce) is set without a nonce or hash source. Track the deferred options (A/B/C) in the roadmap with an owner and target date.
- **Regression Risk:** N/A (audit only).
- **Priority:** **P1.**

---

## 3. Medium Priority (P2)

### F-09 — AI Runtime: no import-time guard forbidding direct `gateway.server.ts` usage outside the Kernel
- **Category:** AI Runtime.
- **Evidence:** `src/lib/ai/gateway.server.ts` is not marked as kernel-private; any future feature could bypass Policy/Budget/Prompt Registry by importing the gateway directly.
- **Recommendation:** Add an ESLint `no-restricted-imports` rule allowing `gateway.server.ts` only from `kernel.server.ts`. Document in `BRAIN-CONSTITUTION.md`.
- **Severity:** MEDIUM. **Priority:** **P2.**

### F-10 — Decision Records lack tamper-evident chaining
- **Category:** AI Runtime / Compliance.
- **Evidence:** `air_kernel_calls` records are append-only in intent but rely solely on RLS. No hash chain (`prev_hash || row_payload`) exists.
- **Recommendation:** Add a `payload_hash` + `prev_hash` column and a trigger computing HMAC-SHA-256 using a server-side secret. Enables audit replay.
- **Severity:** MEDIUM (regulatory readiness). **Priority:** **P2.**

### F-11 — CSP report sink logs to `console.warn` only, no persistence
- **Category:** Observability.
- **Evidence:** `src/routes/api/public/csp-report.ts:25`. Reports vanish with each Worker cold start.
- **Recommendation:** Persist to a `security_csp_reports` table with retention (e.g. 30 days) + daily aggregate view. Deferred to Wave F but note the dependency.
- **Severity:** MEDIUM. **Priority:** **P2.**

### F-12 — No CI enforcement of typecheck / tests on PRs beyond local hooks
- **Category:** DevOps / Quality.
- **Evidence:** No workflow files in `.github/`. Package scripts include `test`, `test:e2e`, `lint`, but nothing gates merges.
- **Recommendation:** Add GitHub Actions matrix: `bun install --frozen-lockfile && bun run lint && tsgo && bun run test`.
- **Severity:** MEDIUM. **Priority:** **P2.**

### F-13 — Virtualization missing on large lists (`/catalog`, `/patients`, `/doctors`, `/dispenses`)
- **Category:** Performance.
- **Evidence:** Routes render mapped `<div>` rows without `@tanstack/react-virtual` (which is already a dep).
- **Recommendation:** Wrap the primary list in `useVirtualizer` when row count > 200.
- **Severity:** MEDIUM. **Priority:** **P2.**

### F-14 — Client-bundle weight (`three`, `@react-three/fiber`, `@react-three/postprocessing`, `framer-motion` + `motion`)
- **Category:** Performance / Bundle Splitting.
- **Evidence:** `package.json` lists both `framer-motion` and `motion` (successor package) — duplicate animation runtimes. Three.js stack is imported by landing/mission-control but no dynamic-import boundary is confirmed.
- **Recommendation:** Deduplicate on `motion` **or** `framer-motion` (pick one). Wrap Three.js scenes in `React.lazy` behind `<ClientOnly>` (already used, verify).
- **Severity:** MEDIUM. **Priority:** **P2.**

---

## 4. Low Priority Enhancements (P3)

- **F-15** No `Strict-Transport-Security` `preload` directive. Consider preload list submission once CSP enforces.
- **F-16** Auth page password field has no visibility toggle — usability, not security.
- **F-17** `docs/engineering/*` lacks an INDEX.md so waves are hard to discover.
- **F-18** No Playwright end-to-end suite covering auth → catalog → dispense happy path (only unit tests under `tests/`).
- **F-19** No dependency scanner run recorded; run `bun run code--dependency_scan` in Wave C.6.
- **F-20** `src/pages/AIChat.tsx` and its route sibling both instantiate copilot state — small duplicate-logic hazard.

---

## 5. Domain-By-Domain Findings Matrix

| Domain | Critical | High | Med | Low | Notes |
|---|---:|---:|---:|---:|---|
| Web (XSS/CSRF/Redirect/Headers) | 0 | 1 (F-08) | 1 (F-15) | 1 (F-16) | Redirect hardening (Wave A) verified; no `dangerouslySetInnerHTML` anywhere; no cookie logic on client. |
| AI Security | 0 | 0 | 2 (F-09, F-10) | 0 | Kernel governs; prompt-registry approval-gated. |
| Database (RLS/SECURITY DEFINER) | 0 | 0 | 0 | 0 | Prior waves closed self-verify/self-approve. No new evidence of RLS gaps this pass. Confirm with fresh `security--run_security_scan` in C.6. |
| Server / Auth | 1 (F-02) | 1 (F-07) | 0 | 0 | `_authenticated` client-side gate + one unauth'd module. |
| Frontend / SSR | 1 (F-01) | 1 (F-04) | 0 | 0 | Live env crash + fake dashboard. |
| Dependencies | 0 | 0 | 1 (F-14) | 1 (F-19) | Duplicate animation lib; no scan in current cycle. |
| Infrastructure | 1 (F-03) | 0 | 2 (F-11, F-12) | 1 (F-15) | Public endpoints unmetered; observability weak. |
| Architecture | 0 | 1 (F-05) | 0 | 2 (F-17, F-20) | Two page trees. |
| Performance | 0 | 0 | 1 (F-13) | 0 | Virtualization deferred. |
| Docs / DevOps | 0 | 1 (F-06) | 0 | 1 (F-18) | `.env.example` misleading. |

Total: **3 P0 · 5 P1 · 6 P2 · 6 P3** = 20 findings.

---

## 6. Verification Steps (for Wave C.6)

Each fix must ship with:
1. Reproduction script or screenshot.
2. Automated test where feasible (unit for schema, Playwright for UI).
3. Re-run of the check that surfaced it (browser console clean for F-01, `security--get_scan_results` for RLS, `bun run test` for regression).
4. Update to `WAVE-C-SECURITY-HARDENING.md` and this doc marking the finding `RESOLVED (commit ...)`.

---

## 7. Constitution reminder

> No automatic fixes during security audits.
> Wave C.5 ends with this report. Wave C.6 is a **planning** wave — still no code changes.
> Only after Wave C.6 produces a prioritized, deduplicated plan with owner + cost estimates does implementation begin, and it does so under a fresh explicit `GO`.
