# TITANUS OMEGA ULTRA — Wave C.6

## Enterprise Remediation Planning

- **Mode:** Planning only. No source, schema, config, or dependency changed.
- **Input:** `docs/engineering/WAVE-C5-PENETRATION-AUDIT.md` (3 P0 · 5 P1 · 6 P2 · 6 P3).
- **Output:** ordered, deduplicated, dependency-aware remediation queue with owners,
  effort, regression risk, root cause, immediate + long-term fix, and cut line.
- **Methodology adopted (per Chief directive):**
  Evidence → Prioritization → Approval → Implementation → Verification.
  Fixes ship **one coherent group at a time** in Wave C.7, each followed by tests +
  regression report. No cross-group batching.

Effort key: `XS` ≤ 2h · `S` ≤ 0.5d · `M` ≤ 2d · `L` ≤ 5d · `XL` > 5d.
Regression risk: `Low / Medium / High`.
Owner: `Frontend / Backend / Security / AI Runtime / DevOps / Docs`.

---

## 0. Deduplication & merges applied

| Original | Merge action | Rationale |
|---|---|---|
| F-15 (HSTS preload) | Folded into F-08 (CSP graduation group). | Same header pipeline, same owner, same milestone. |
| F-20 (duplicate copilot state in `src/pages/AIChat.tsx` + route sibling) | Absorbed into F-05 (two page trees). | Same root cause; deleting `src/pages/` resolves both. |
| F-19 (no dep scan) | Absorbed into F-12 (CI gates). | Dep scan is a CI job; single owner, single PR. |
| F-16 (password visibility toggle) | Kept separate; usability only, not security. | Different owner (Frontend UX). |

Net queue after merges: **17 items** in **8 groups**.

---

## 1. Root-cause differentiation for F-01 (per Chief note)

Before F-01 is treated as a code bug, C.6 formally splits it into three
mutually-exclusive hypotheses. Wave C.7 must falsify each in order.

| Hypothesis | How to verify (read-only) | If true → fix location |
|---|---|---|
| **H1 — Preview env is not injected.** Lovable Cloud only injects `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` when the backend is bound to the preview. | Inspect built bundle for the literal `VITE_SUPABASE_URL` replacement value; check `import.meta.env` dump in a debug route; confirm backend binding for preview URL in Lovable Cloud. | **Deployment configuration** — no app code change. Document expectation in `.env.example` + README; keep the guard as a fail-loud message. |
| **H2 — Variable naming drift.** Bundle expects `VITE_SUPABASE_PUBLISHABLE_KEY` but injection uses `VITE_SUPABASE_ANON_KEY` (or vice versa). | `rg import.meta.env.VITE_SUPABASE` across `src/`; compare with names Lovable Cloud actually injects. | **Application code** — align the client to whichever name Cloud injects, keep both as fallback with priority order. |
| **H3 — SSR path executes the client module.** `src/integrations/supabase/client.ts` is imported from an SSR-rendered route where `import.meta.env.VITE_*` is available but the `process.env.*` fallback path is taken accidentally on the client. | Grep for module-scope imports of `@/integrations/supabase/client` in `.server.ts` files; verify no `.functions.ts` transitively pulls it. | **Application code** — remove `process.env.*` fallback from the client module; server callers must use `@/integrations/supabase/client.server` or `requireSupabaseAuth`. |

**Rule:** Wave C.7 records which hypothesis is confirmed in the fix commit
message. If H1 alone is true, no source patch ships — only docs + deployment
verification. That preserves "the code is not automatically assumed guilty."

---

## 2. Master remediation table

| ID | Title | Root Cause | Immediate Fix (min viable) | Long-term Fix (enterprise) | Regression Risk | Dependencies | Effort | Release | Owner |
|---|---|---|---|---|---|---|---|---|---|
| **F-01** | Supabase env unresolved on `/` | See §1 — H1 / H2 / H3 | Confirm hypothesis; if code, align env-var name and remove `process.env.*` fallback from client module | Add build-time assertion in `vite.config.ts` that fails the build when `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` are absent; publish `.env.example` matching Cloud contract | Low | — | S (H1) · M (H2/H3) | **Before Launch** | Backend + DevOps |
| **F-03** | Public POST endpoints unmetered | Public routes each write their own guard; shared `public-endpoint-guard.server.ts` from prior wave not wired in | Reinstate the shared guard as request middleware on `src/routes/api/public/*`: IP-hash cooldown, 16 KB pre-parse cap, correlation ID header, structured log | Move guard to a route-file-generator pattern so any new `api/public/*` route is guarded by construction; add e2e test spamming the sink | Low | F-01 (need working runtime to test) | M | **Before Launch** | Backend + Security |
| **F-02** | `_authenticated` uses `ssr: false` | Supabase session lives in `localStorage`, unreadable during SSR; layout deliberately client-only to avoid redirect loops | **Decision task first**: document whether `ssr:false` is intentional per current TanStack + Supabase constraints. If intentional, keep it and add loading skeleton + `noscript` fallback. If not, wire cookie-based session (`@supabase/ssr`) and flip `ssr:true` | Adopt `@supabase/ssr` cookie session across the app; enable SSR for protected routes; keep `requireSupabaseAuth` as defense-in-depth | Medium | F-01 (needs runtime) | M (keep) · L (flip) | **Before Launch** (decision) · After Launch (flip) | Backend |
| **F-07** | `inventory.functions.ts` missing `requireSupabaseAuth` | Historical TODO from before auth middleware was ready | Attach `requireSupabaseAuth` to every exported `createServerFn` in `inventory.functions.ts` + mutations file; delete the TODO | Add ESLint rule forbidding `createServerFn` without a `.middleware([...])` chain in `src/lib/*.functions.ts` (opt-out list for the small set of intentionally public fns) | Low | — | S | **Before Launch** | Backend + Security |
| **F-04** | `SecurityModule.tsx` hardcoded posture | Placeholder UI never wired to real data | Remove the module from routing behind a `?debug=1` guard, or hide the route; replace static rows with an "unavailable" banner | Rewrite the module to query real data: RLS count from `pg_policies`, MFA from `auth.mfa_factors`, audit from `audit_log` (new `security.functions.ts`) | Low | F-07 (auth middleware present) | S (hide) · L (rebuild) | **Before Launch** (hide) · After Launch (rebuild) | Frontend + Security |
| **F-06** | `.env.example` documents fictional envs | Legacy file from earlier design phase | Rewrite `.env.example` to the real contract: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, server-only `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`; red-boxed comment banning secrets under `VITE_*` | Add lint check parsing `.env.example` against a schema in `src/lib/env/schema.ts` used by both client and server loaders | Zero | F-01 (share findings) | XS | **Before Launch** | Docs + DevOps |
| **F-05** | Two page trees (`src/pages/*` + `src/routes/*`); duplicate copilot state (was F-20) | Legacy pre-TanStack-routing files never removed | Inline each `src/pages/*` into its owning `src/routes/*` file (or move to `src/components/` if shared); delete `src/pages/` | Add ESLint `no-restricted-imports` forbidding imports from `src/pages/*`; add CI check that `src/pages/` does not exist | Low | — | M | After Launch (P1) | Frontend |
| **F-08** | CSP still allows `'unsafe-inline'`; HSTS lacks `preload` (merged F-15) | Nonce-per-request not natively supported by TanStack `<Scripts />` yet | Pick one of the three Phase-1.5 deferred options (A/B/C); add CI check failing if enforce-CSP header is set without a nonce/hash source | After enforce flip stabilises for 2 weeks: submit domain to HSTS preload list; document rollback | N/A (planning); Medium (on flip) | F-01 (runtime alive), F-11 (need report data to validate) | L | After Launch (Sprint 2) | Frontend + Security |
| **F-11** | CSP reports go to `console.warn` only | Persistence deferred to Wave F | Create `security_csp_reports` table (org-scoped RLS off, service-role only), write from `csp-report.ts`, 30-day retention view | Materialised view + admin dashboard tile in `/admin-sovereign` | Low | F-03 (guard) | M | After Launch (Sprint 2) | Backend + Observability |
| **F-09** | Kernel bypass possible — `gateway.server.ts` importable directly | No import-time attestation | ESLint `no-restricted-imports`: `src/lib/ai/gateway.server.ts` importable only from `src/lib/ai/runtime/kernel.server.ts` | Move gateway module inside `src/lib/ai/runtime/` and mark it `@internal`; add runtime attestation logging caller stack on non-kernel entry (dev only) | Low | — | S | After Launch (Sprint 2) | AI Runtime |
| **F-10** | Decision Records lack tamper-evident chain | `air_kernel_calls` is append-only in intent only | Add `payload_hash` + `prev_hash` columns; trigger computes HMAC-SHA-256 from server-side secret | Add periodic chain-verification job + admin tile showing last verified block | Medium (migration on hot table) | F-09 (guard the writer) | M | After Launch (Sprint 3) | AI Runtime + Backend |
| **F-12** | No CI gates on PRs (absorbs F-19 dep scan) | Repo relies on local hooks | Add GitHub Actions: `bun install --frozen-lockfile && bun run lint && tsgo && bun run test && bun run code--dependency_scan` on PR + `main` | Add release workflow producing SBOM + signed provenance | Low | — | S | **Before Launch** (typecheck + test job) · After Launch (SBOM) | DevOps |
| **F-13** | List virtualization missing | Not implemented; dep already present | Wrap `/catalog`, `/patients`, `/doctors`, `/dispenses` primary lists in `@tanstack/react-virtual` when rows > 200 | Extract `<VirtualList />` primitive under `src/components/data/`; adopt across all list routes | Low | — | M | After Launch (Sprint 2) | Frontend |
| **F-14** | Duplicate animation runtimes + heavy Three.js bundle | Both `framer-motion` and `motion` installed | Deduplicate on one animation package; verify Three.js scenes lazy-load behind `<ClientOnly>` | Bundle budget CI check (max KB per route); route-level dynamic imports for heavy landing | Medium (motion API differs slightly) | — | S | After Launch (Sprint 2) | Frontend |
| **F-18** | No Playwright e2e suite | Only unit tests exist | Add smoke suite: auth → catalog list → dispense open (headless, single browser) | Full journey coverage across CRM, medical, insurance; visual regression snapshots | Low | F-12 (CI) | L | After Launch (Sprint 3) | DevOps + QA |
| **F-17** | `docs/engineering/*` lacks index | Waves shipped without directory | Add `docs/engineering/INDEX.md` listing waves A → C.6 with status | Auto-generate from front-matter | Zero | — | XS | After Launch (Sprint 2) | Docs |
| **F-16** | Password field has no visibility toggle | Usability, not security | Add show/hide toggle to `/auth` password inputs | N/A (single fix suffices) | Low | — | XS | Backlog | Frontend |

---

## 3. Dependency graph

```text
F-01 (Supabase env)
  ├─► F-03 (public guard) — needs live runtime to smoke-test
  ├─► F-02 (SSR decision)  — needs runtime to profile SSR path
  ├─► F-06 (.env.example)  — shares evidence with F-01 hypothesis outcome
  └─► F-08 / F-11 (CSP graduation) — needs runtime + observability

F-07 (auth on inventory) ─► F-04 (rebuild security dashboard)
F-09 (kernel guard)      ─► F-10 (tamper-evident chain writer)
F-12 (CI)                ─► F-18 (e2e in CI)
```

**Implication for Wave C.7 sequencing:** F-01 unblocks 5 downstream items;
therefore it MUST be the first ticket, regardless of finding number.

---

## 4. Ordered execution queue (for Wave C.7)

### Phase R0 — Release Blockers (must land before any public soft-launch)

1. **R0.1 — F-01** — Supabase bootstrap (root-cause differentiation per §1). Ship
   the confirmed hypothesis's fix only. **Standalone commit.**
2. **R0.2 — F-03** — Public endpoint guard (single shared middleware wired to all
   `api/public/*`). **Standalone commit.**
3. **R0.3 — F-02 (decision)** — Decision task: `ssr:false` intentional or not.
   Ship the decision record + minimal guard-rails (skeleton + `noscript`) only.
   Full SSR flip is Phase R1. **Standalone commit.**
4. **R0.4 — F-07** — Attach `requireSupabaseAuth` to `inventory.functions.ts`
   and mutations. **Standalone commit.**
5. **R0.5 — F-06** — Rewrite `.env.example`. **Standalone commit** (docs only).
6. **R0.6 — F-04 (hide-only)** — Remove `SecurityModule` from routing behind
   debug flag. **Standalone commit.**
7. **R0.7 — F-12 (partial)** — CI: `lint + tsgo + test` only. **Standalone commit.**

### Phase R1 — High Priority (first post-launch sprint)

8. **F-05** — Delete `src/pages/*` after inlining. Verify no broken imports.
9. **F-04 (rebuild)** — Real `SecurityModule` backed by `security.functions.ts`.
10. **F-08 + F-11** — CSP graduation package (report persistence first, then
    enforce flip). Ship as **two commits** in order.

### Phase R2 — Depth (Sprint 2/3)

11. **F-09 → F-10** — Kernel guard, then tamper-evident chain.
12. **F-13** — Virtualization primitive + rollout.
13. **F-14** — Bundle deduplication.
14. **F-12 (SBOM) + F-18** — CI depth + e2e.

### Phase R3 — Polish (backlog)

15. **F-17** — Docs index.
16. **F-16** — Password toggle.

---

## 5. Release gate summary

| Group | Findings | Effort (dev-days) | Release |
|---|---|---:|---|
| **R0 — Blockers** | F-01, F-03, F-02(decision), F-07, F-06, F-04(hide), F-12(partial) | ~5 – 7 | **Before Launch** |
| **R1 — Post-launch S1** | F-05, F-04(rebuild), F-08, F-11 | ~10 | Sprint 1 |
| **R2 — Depth** | F-09, F-10, F-13, F-14, F-12(SBOM), F-18 | ~14 | Sprint 2/3 |
| **R3 — Polish** | F-17, F-16 | ~0.5 | Backlog |
| **Total** | 17 items | ~30 dev-days | — |

See `docs/engineering/RELEASE-GATE.md` for the launch gate IDs.

---

## 6. Wave C.7 execution rules (constitution)

Adopted verbatim from Chief directive:

1. Fix **one item or one tightly-coupled group** per change set.
2. Run tests after every group (`bun run test` + `tsgo` minimum; smoke Playwright
   when relevant).
3. Publish a **Regression Report** after each group in
   `docs/engineering/WAVE-C7-REGRESSION-LOG.md`.
4. Never merge unrelated fixes in the same commit.
5. F-01 code fix is conditional on hypothesis confirmation (§1). If evidence
   points only to deployment config, ship docs + verification, not source.
6. Update `WAVE-C5-PENETRATION-AUDIT.md` marking each finding
   `RESOLVED (commit …)` at close.

---

## 7. What Wave C.6 shipped

- This document (deduplicated, dependency-ordered, owner+effort table).
- `docs/engineering/RELEASE-GATE.md` (launch-blocking finding IDs).
- **Zero source changes.** Awaits explicit `GO` for Wave C.7.
