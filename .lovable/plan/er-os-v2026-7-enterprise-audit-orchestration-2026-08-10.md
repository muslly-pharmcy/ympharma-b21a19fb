# ER-OS v2026.7 — Enterprise Audit Orchestration

## Scope confirmed by discovery

- ~52,000 lines across 285 TypeScript/TSX files → **chunk-by-domain strategy** (50k–200k band).
- 23 route entries under `src/routes` (incl. `api/public/*` webhook + cron endpoints).
- 43 `*.functions.ts` server-function modules.
- 51 database migrations under `supabase/`.
- Lockfiles present: `bun.lock`, `package-lock.json` → dependency findings can carry real `DEPENDENCY_LOCK` provenance.
- Existing test suite under `tests/` → some findings can reach `VERIFIED_TESTS`.

No source claim in the final report will be made without a read; anything unread is reported as `AUDIT_BLINDSPOT`.

## Execution approach

Three specialist agents run in parallel, each read-only, each given only its domain slice. I synthesize their raw output into the required schema.

**Agent Alpha — Security & Compliance (Phases 3, 4, 5)**
Auth middleware and `requireSupabaseAuth` coverage across all 43 server-function modules; every `/api/public/*` route's caller verification (HMAC/cron-auth); `supabaseAdmin` usage sites and whether each verifies role before privileged work; RLS + GRANT coverage per public table; secret handling (`process.env` at module scope, `VITE_` leakage); AI/agent safety (prompt injection surface in the chat widget and AI kernel, MCP route integrity, RAG/memory poisoning); dependency CVEs from the real lockfile; CI/CD workflow secret exposure. Output mapped to STRIDE + MITRE.

**Agent Beta — Architecture & Quality (Phases 2, 7)**
God objects and cyclic/layer violations across `src/lib`, `src/domain`, `src/modules`, `src/super-agent`; type-safety escapes (`any`, `as never`, non-null assertions); server/client boundary correctness for TanStack Start; migration-vs-`types.ts` schema drift; N+1 query patterns and missing indexes on hot paths (catalog, store view, orders, dispenses).

**Agent Gamma — Operations & Resilience (Phases 6, 8)**
SPOF and blast-radius (AI kernel, event bus, DLQ, cron jobs); race conditions in FEFO checkout and stock decrement; retry/idempotency gaps; FinOps — uncached LLM calls, per-request model invocations, unbounded loops; bundle/Web-Vitals risks in the landing and 3D scenes.

## Real tool runs (no simulated output)

Executed before findings are written, so provenance is `TOOL_OUTPUT` rather than hypothesis:

1. `bunx tsgo` — type-check across the project.
2. `bunx vitest run` — existing test suite.
3. `npm audit` via the dependency scanner — lockfile CVEs.
4. Backend security scan + linter — RLS, grants, definer functions.
5. Targeted DB queries — table/policy/grant/index inventory, schema drift.
6. Static greps for the specific anti-patterns above.

Anything requiring a profiler, load test, or DAST scanner is not runnable here and will be labeled `DYNAMIC_HYPOTHESIS` / `TOOL_REQUIRED`.

## Falsification pass

Before a finding enters the register I check whether the framework already mitigates it — `requireSupabaseAuth` middleware, RLS enforcement, Zod input validators, the public-endpoint guard, the cron-auth middleware, TanStack's client-bundle stripping of handler bodies. Mitigated items are dropped or downgraded and listed in the Blindspot report with the reason.

## Deliverable

A single report written to `docs/engineering/ER-OS-v2026.7-AUDIT.md`, containing exactly the requested sections:

1. Executive Scorecard — Production Readiness Index, compliance matrix (SOC 2 / HIPAA / GDPR / ISO 27001), risk profile.
2. Architecture Map — Mermaid component diagram with security boundaries and agent control loops.
3. Findings Register — the full table (ID, Phase, Agent, Severity, Provenance, File:Line, STRIDE/MITRE, Triage, Status, Patch).
4. Debt & Metrics Register.
5. Blindspot & Limitations Report.
6. Production Checklist & Rollback.

Plus per-phase Gate Blocks with evidence ratios.

## Code changes in this pass

**None by default.** This run is audit-only: findings carry `[PROPOSED]` patches as diffs inside the report. Say the word and I'll apply the Critical/High fixes in a follow-up pass, each one verified against the type-check and test suite before it lands.
