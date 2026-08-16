# Wave C.7 — Regression Log

Chronological record of each remediation ticket landed in Wave C.7.
Format per entry: **Ticket → Root cause → Change scope → Verification → Result**.

---

## R0.1 — F-01 Supabase bootstrap crash on `/`

**Date:** 2026-07-20
**Standalone commit:** yes (docs-only per Rule 1)
**Constitutional rule invoked:** Rule 1 (Verify Before Patch) + §1 hypothesis triage.

### Hypothesis verification

| Hyp. | Predicate | Evidence | Verdict |
|---|---|---|---|
| **H1** — Preview build ran without env injection. | If true: `.env` contains correct keys **now** but the failing bundle predates the injection; no code change fixes it — only a rebuild with env bound. | `.env` present with `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (mtime `2026-07-20 22:31`). Failing bundle timestamp in console log: `2026-07-20 22:09` (bundle hash `index-DdUM4bbP.js`). Bundle predates env by ~22 minutes. | ✅ **Confirmed** |
| **H2** — Variable-name drift between code and Cloud contract. | If true: bundle expects `VITE_SUPABASE_ANON_KEY` while Cloud injects `VITE_SUPABASE_PUBLISHABLE_KEY` (or vice-versa). | `rg import.meta.env.VITE_SUPABASE`: only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are read. `.env` supplies exactly those names. | ❌ Falsified |
| **H3** — SSR path executes client module and hits `process.env.*` fallback. | If true: error stack originates from SSR entry (`src/server.ts` chain), and only server-side. | Error stack points to `qp` inside `/assets/index-DdUM4bbP.js` (client bundle chunk name), thrown from `client.ts:36` guard. No `.server.ts` / `.functions.ts` imports `@/integrations/supabase/client`. | ❌ Falsified |

### Change scope

- **Source code:** none. Rule 1 forbids a patch when only H1 holds.
- **Docs:** this log entry + confirmation in `RELEASE-GATE.md`.
- **Deployment action required (owner: DevOps / Chief):**
  1. Trigger a fresh preview build so Vite replaces `import.meta.env.VITE_SUPABASE_*` with the now-present `.env` values.
  2. Confirm the emitted bundle contains the literal Supabase URL (grep the new `assets/index-*.js` for the project ref).
  3. Reload `/` and verify no `Missing Supabase environment variable(s)` in console.

### Verification (post-rebuild — awaiting DevOps confirmation)

- [ ] New bundle hash differs from `index-DdUM4bbP.js`.
- [ ] Console has no `Missing Supabase environment variable(s)` error.
- [ ] `/` renders past `ErrorBoundary`.

### Result

Root cause isolated to **deployment configuration** (H1). No application code changed. Ticket stays **⛔ Open in RELEASE-GATE** until post-rebuild verification checkboxes above are ticked. Downstream tickets (F-03 smoke-test, F-02 SSR profile, CSP report validation) remain blocked on that rebuild.

### Notes / follow-up backlog (do not fix in R0.1)

- `client.ts:33-34` has a `process.env.*` fallback that is dead code in the browser bundle. Vite does not replace `process.env.SUPABASE_URL` for the client target, and there is no polyfill; the expression evaluates to `undefined`. Removing it would make the intent explicit but is **out of scope for R0.1** (would violate Rule 2 — one root cause per commit). File as a P3 cleanup ticket under Wave C.7 backlog.

---

## R0.2 — F-03 Public endpoint guard consolidation

**Date:** 2026-07-20
**Standalone commit:** yes (single root cause per Rule 2)
**Constitutional rule invoked:** Rule 2 (One root cause per commit) + Rule 3 (Regression gate).

### Root cause

`/api/public/*` endpoints implemented their own body-size handling and had
no shared rate limit, content-type allowlist, method allowlist, or
correlation id. Only `csp-report` existed today, but any new public POST
would inherit the same divergence.

### Change scope

- **New:** `src/lib/security/public-endpoint-guard.server.ts` — single
  `guardPublicRequest(request, opts)` primitive enforcing:
  1. Method allowlist (default `POST`).
  2. Content-type prefix allowlist (default JSON + CSP report).
  3. Body cap by both `content-length` header and read length (default 16 KB).
  4. Per-IP sliding-window rate limit (default 30 / 60 s). IP is
     SHA-256 hashed before use — raw IPs never touch logs.
  5. Correlation id (`pub_…`) surfaced on every response via
     `x-correlation-id` and in the structured admission log.
- **Wired:** `src/routes/api/public/csp-report.ts` now delegates to the
  guard (window kept at 60 s but ceiling raised to 120 to absorb bursty
  browser reports during bad deploys).
- **Tests:** `tests/public-endpoint-guard.test.ts` (5 cases):
  accept-happy-path, 405 wrong method, 415 wrong content-type,
  413 oversized declared body, 429 after rate-limit exhaustion with
  `retry-after` header.

### Verification

- [x] `bunx vitest run tests/public-endpoint-guard.test.ts` → 5/5 pass.
- [x] Full suite regression: 88/88 previously green tests still pass
      after the guard lands (checked earlier in this shipment).
- [x] `csp-report` response contract unchanged (still `204` on success);
      only the failure envelope is new and only fires for abusive callers.
- [ ] Post-rebuild smoke against preview (blocked on R0.1 rebuild):
      POST 121× to `/api/public/csp-report` from same IP → observe 429
      with `retry-after` and matching `x-correlation-id`.

### Scope discipline

- No F-01 or F-02 changes rode along. F-01 stays deployment-only.
- Auth-less inventory functions (F-07) and `.env.example` (F-06) are
  separate root causes and remain open in the release gate.
- In-memory rate-limit store is intentional for R0.2; a shared KV / Redis
  store is filed as a P2 follow-up under Wave C.7 backlog (not a blocker
  for the current single Worker deploy topology).

### Protected surface after R0.2

| Route | Guarded | Notes |
|---|---|---|
| `POST /api/public/csp-report` | ✅ | 120 req / 60 s / ip-hash, 16 KB cap |

No other `/api/public/*` routes exist today; the guard is the mandatory
entry point for any future addition (documented in the module header).

### Result

F-03 root cause closed: the guard is implemented, wired, and tested.
Status held at 🟢 **Guard shipped · pending post-rebuild smoke** until
the R0.1 rebuild lets us execute the live 429 verification. Only then
does F-03 move to ✅ Resolved.

---

## R0.3 — F-02 `_authenticated` SSR profile review

**Date:** 2026-07-20
**Standalone commit:** yes (docs-only per Rule 1)
**Constitutional rule invoked:** Rule 1 (Verify Before Patch).

### Verification outcome

F-02 is not a defect. `_authenticated/route.tsx` with `ssr: false` is the
**integration-managed** canonical pattern for Lovable Supabase auth on
TanStack Start (localStorage session store). Full evidence, alternative
analysis, and per-scenario acceptance table live in
`docs/engineering/adr/ADR-F02-authenticated-ssr.md`.

### Change scope

- **Source code:** none. Rule 1 forbids a patch when the audited artifact
  is already correct.
- **Docs:** new ADR `docs/engineering/adr/ADR-F02-authenticated-ssr.md`;
  this log entry; `RELEASE-GATE.md` status update.

### Acceptance matrix (all ✅)

| Scenario | Result |
|---|---|
| Unauthenticated visit → redirect, no flash | ✅ |
| Authenticated on `/auth` → bounce to `redirect` | ✅ |
| Hard refresh on `/catalog` signed in → no flash | ✅ |
| Sign out → cache teardown + gate redirect | ✅ |
| Redirect loop | None (safeRedirect + gate contract) |
| Protected content flash | None |
| SSR regression on public routes | None |

### Result

F-02 closed as **✅ Resolved — documented as intentional**. Downstream
work (F-07) unblocked and can proceed as R1.1 per Chief's ordering.

### Notes / follow-up (do not fix now)

- Cookie-backed SSR sessions (`@supabase/ssr`) would allow `ssr: true`
  on protected routes but is an architectural change with no security
  gap to close. Filed as P3 backlog ("SSR-cookie session migration") for
  a future wave; not a release blocker.

---

## R1.2 — F-04 Fake Security Dashboard

**Date:** 2026-07-21
**Standalone commit:** yes (single file + docs)
**Constitutional rule invoked:** Rule 1 (Verify Before Patch) + Rule 4 (Evidence Closure).
**ID note:** discussed as "F-06" in-chat; the release gate row is **F-04 (hide)**. Same finding, correct ID recorded here.

### Verification

- Read `src/modules/security/SecurityModule.tsx` — confirmed **all** rendered values were hard-coded literals (`securityStatus`, `auditLogs`, `roles`, RLS policy list, "2,847 users", "0 threats"). Zero queries, zero server functions, zero props from a data source.
- Grep for consumers: only mounted from `src/pages/PlanetPage.tsx` (`security` planet). No other importers, no tests depend on the fake shape.
- No real telemetry backend is wired for this surface today (`audit_events` / `ai_security_events` / `error_logs` exist but no aggregation endpoint).

### Change scope

- **Source code:** `src/modules/security/SecurityModule.tsx` fully rewritten.
  - Removes: fake status grid, fake user counts, fake audit logs, fake RLS policy claims, "no active threats" banner, tab UI hanging off empty state.
  - Adds: amber "قيد التطوير" banner, three factual panels (RLS enabled on sensitive tables, Supabase Auth via Lovable, real audit lives in DB tables), link to real `/ai-runtime` surface. No `useState`, no counters.
- **Docs:** this entry + `RELEASE-GATE.md` F-04 row flipped to ✅ Resolved.
- **No DB / RLS / server-fn changes.**

### Acceptance

| Check | Result |
|---|---|
| No hard-coded counts / user totals rendered | ✅ |
| No fabricated audit log entries rendered | ✅ |
| No fabricated RLS policy list rendered | ✅ |
| Honest "in development" disclosure visible above the fold | ✅ |
| Admin pointer to a real observability surface (`/ai-runtime`) | ✅ |
| No new imports of admin/service-role clients | ✅ |

### Result

F-04 closed as **✅ Resolved**. Follow-up (not this wave): wire the panel to
`audit_events` / `ai_security_events` aggregations behind
`requireSupabaseAuth` + admin role check when a real security-ops surface is
prioritized.

---

## R1.3.2 — CRM cluster RLS enablement (Bucket B, groundwork for R1.3.3)

**Date:** 2026-07-21
**Standalone commit:** yes (migration + docs, no handler code)
**Wave:** R1.3.2 — first tranche of R1.3.1 Bucket B follow-through.

### Hypothesis verification (Rule 1)

The R1.3.1 audit classified 35 handlers as "Replace with RLS" on the assumption
that the target tables either had org-scoped RLS policies or that adding them
would be trivial. Before writing any migration, verified the current schema
state for the 13 CRM Bucket B tables.

| Hyp. | Predicate | Evidence | Verdict |
|---|---|---|---|
| **H1** — Tables use `organization_id` as the tenant column. | `information_schema.columns` returns `organization_id` for all 13 tables. | Confirmed on `crm_customers`, `crm_customer_contacts/addresses/tags`, `crm_campaigns`, `crm_campaign_events`, `crm_segments`, `crm_loyalty_{accounts,transactions,rules,tiers}`, `crm_reward_{catalog,redemptions}`. | ✅ Confirmed |
| **H2** — Org-scoped RLS policies already exist and reuse a shared helper. | `pg_policies` shows every table already carries policies keyed on `public.is_org_member(organization_id, auth.uid())` — a `STABLE SECURITY DEFINER` helper that checks `organization_members` for the active membership. | Confirmed. | ✅ Confirmed |
| **H3** — Handlers use `supabaseAdmin` because RLS is misconfigured. | If false, the real gap is elsewhere. | RLS is enabled on all 13 tables (`pg_class.relrowsecurity = true`) and the policies are correct. `information_schema.role_table_grants` returned **zero** rows for `authenticated`/`service_role`/`anon` on any of the 13 tables. `has_table_privilege('authenticated', ...)` confirmed no privileges granted before the migration. | ❌ **Falsified — real root cause identified** |

**Root cause (revised):** the handlers were forced to `supabaseAdmin` not
because RLS was missing, but because **the tables were never granted to the
Data API roles**. PostgREST/`authenticated` had no table-level privilege, so
`context.supabase` returned a permission error and every author fell back to
the service-role client. The R1.3.1 doc's Bucket B rationale ("org filter +
role check duplicate what an RLS policy would enforce") holds — the policies
exist and duplicate the code — but the concrete unblocker for R1.3.3 is
GRANTs, not new policies.

### Change scope

- **Migration `20260721021144`:**
  - `GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO authenticated` for
    all 13 CRM Bucket B tables.
  - `GRANT ALL ON <table> TO service_role` for the same 13 tables.
  - No `anon` grants — every policy scopes on `auth.uid()` via
    `is_org_member`, so `anon` reads would return zero rows regardless; not
    granting keeps the least-privilege posture.
  - Added `UPDATE` and `DELETE` policies on `crm_campaign_events` (previously
    only `SELECT` + `INSERT`), keyed on the same `is_org_member` predicate
    used by its existing pair. This closes a real gap — the audit noted the
    table but the policy set was asymmetric — so R1.3.3 can migrate campaign
    event mutations to `context.supabase` without hitting a "no policy for
    UPDATE" error.
- **Source code:** none in this wave. Handlers still use `supabaseAdmin`; the
  cutover is R1.3.3.
- **Docs:** this entry + follow-up backlog item recorded below.

### Verification

| Check | Query | Result |
|---|---|---|
| Grants present on all 13 tables | `has_table_privilege('authenticated', c.oid, 'SELECT'/'INSERT'/'UPDATE'/'DELETE')` | ✅ `true` for all 13 × 4 combinations |
| Service role has full access | `has_table_privilege('service_role', c.oid, 'SELECT')` | ✅ `true` for all 13 |
| Policy set complete on `crm_campaign_events` | `SELECT cmd, count(*) FROM pg_policies WHERE tablename='crm_campaign_events' GROUP BY cmd` | ✅ one row each for `SELECT`, `INSERT`, `UPDATE`, `DELETE` |
| RLS still enabled | `pg_class.relrowsecurity` for all 13 | ✅ `true` for all 13 |
| Linter warnings introduced | Post-migration linter output | 211 warnings — all pre-existing (`SECURITY DEFINER` public exec on legacy functions, `extension in public`). **Zero new warnings attributable to this migration.** |

### Non-goals verified

- No handler rewrites (R1.3.3).
- No changes to `session.server.ts`, `idempotency.server.ts`, or the
  `_authenticated/` route gate.
- No Bucket C mutations touched (loyalty ledger, campaign send, etc. — those
  stay on `supabaseAdmin` pending R1.3.4 service extraction).
- No medical / supply / platform clusters (queued for R1.3.2b/c/d).

### Result

**R1.3.2 (CRM cluster) → ✅ Complete.** The 9 Bucket B handlers listed in
`WAVE-R1.3.1-ADMIN-BYPASS-CLASSIFICATION.md` under `customers.functions.ts`,
`customers.mutations.functions.ts`, `campaigns.functions.ts`, and
`loyalty.functions.ts` are now unblocked for R1.3.3 cutover to
`requireSupabaseAuth` + `context.supabase`.

### Follow-up backlog (unchanged sequence)

- **R1.3.2b — Medical cluster grants** (`hc_*`, `insv2_*`, `patient_*`
  Bucket B tables). Same verification pattern.
- **R1.3.2c — Supply cluster grants** (`catalog_*`, `inv_*`, `sup_*`,
  `wh_*` Bucket B tables).
- **R1.3.2d — Platform cluster grants** (`medical_*`, `cart_items`
  Bucket B tables).
- **R1.3.3 — Handler cutover.** For each Bucket B handler, add
  `.middleware([requireSupabaseAuth])`, replace `supabaseAdmin` with
  `context.supabase`, keep the existing `requirePermission` /
  `actor.organizationId` guards as defence-in-depth. Regression test per
  handler under two orgs to prove RLS blocks cross-tenant reads/writes.
- **R1.3.4 — Bucket C service extraction** (54 handlers, dispenses/loyalty
  ledger/insurance/purchasing/campaigns/promotions state machines).
- **R1.3.5 — Bucket D repair.** Currently zero rows; keep on the tracker in
  case future waves expose new candidates.
- **R1.4 → R1.6** — contract, boundary, secrets audits. Queued.

