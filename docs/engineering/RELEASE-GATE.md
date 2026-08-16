# Release Gate — MUSLLY AI OS

**Source:** `WAVE-C6-REMEDIATION-PLAN.md` §4 Phase R0.
**Rule:** Public soft-launch is blocked until every ID below reports
`RESOLVED`.
**Last verified:** 2026-08-14 (re-baselined against the repository, not against
prior reports — see `REPAIR_REPORT.md`).

## Launch-blocking findings (Phase R0)

| ID | Title | Status | Evidence |
|---|---|---|---|
| F-01 | Supabase env unresolved on `/` | 🟡 Pending rebuild verification | Root cause confirmed as stale deploy-time bundle; needs a publish + smoke check |
| F-02 | `_authenticated` SSR decision record | ✅ Resolved | `adr/ADR-F02-authenticated-ssr.md`; integration-managed canonical pattern |
| F-03 | Public POST endpoints unmetered | ✅ Resolved | `src/lib/security/public-endpoint-guard.server.ts` wired; `tests/public-endpoint-guard.test.ts` green |
| F-04 | `SecurityModule` fake dashboard | ✅ Resolved | Replaced with honest "in development" panel |
| F-06 | `.env.example` rewrite to real contract | ✅ Resolved | `.env.example` contains only client-safe `VITE_*` keys with placeholders |
| F-07 | `inventory.functions.ts` missing `requireSupabaseAuth` | ✅ Resolved | Every `createServerFn` in that file carries `.middleware([requireSupabaseAuth])` (verified by inspection 2026-08-14) |
| F-12 | CI: `lint + typecheck + test` on PR + `main` | ✅ Resolved | `.github/workflows/ci.yml` |

## Current verification baseline

| Check | Command | Result (2026-08-14) |
|---|---|---|
| Typecheck | `bunx tsgo --noEmit` | Pass, 0 errors |
| Lint | `bunx eslint .` | Pass, 0 errors, ~92 classified warnings |
| Unit tests | `bunx vitest run` | 206 passed / 206 |
| E2E | `bunx playwright test` | NOT VERIFIED in this environment |

## Non-blocking (may ship post-launch)

See Phases R1, R2, R3 in `WAVE-C6-REMEDIATION-PLAN.md`.

## Update protocol

When a finding is closed:

1. Mark the row above `✅ Resolved` with the concrete evidence.
2. Update `WAVE-C5-PENETRATION-AUDIT.md` finding status.
3. Append an entry to `WAVE-C7-REGRESSION-LOG.md`.
