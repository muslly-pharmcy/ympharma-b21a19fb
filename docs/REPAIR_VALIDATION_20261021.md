# Repair validation — 21 October 2026

Base: `7ecf324de1a1f9748b685b7e744fd543e097b8e5`, branch `fix/tooling-blockers-20261021`.
The original batch below repaired the remote STORE checkout. At that checkpoint the separate local STORE report batch
`8691c938e4fa2115fe878b86b7b0d83be7e5118f`, ERP122 and the worker checkout were not merged or edited.

## Changes

- Restore dependency, build, environment, editor and test exclusions; keep sanitized environment templates.
- Convert developer scripts to ESM and resolve paths from their own repository. Optional Docker/PowerShell absence does not fail the doctor; Docker CLI presence does not prove engine health.
- Route package commands through wrappers. Invoke local CLIs without shell interpolation or automatic npx downloads.
- Validate Strix's object-shaped allowlist, exact local targets and the existing image pin. Block latest/image overrides, URLs, traversal and junction escapes. Mount only the staged source read-only and reports separately.
- Keep Cloudflare validation arguments fixed and reject overrides before loading dependencies. This carries forward the existing worker branch's guard, with validation moved before dependency resolution.
- Patch TanStack Start to 1.168.60/core 1.169.39, with matching router 1.170.41/plugin 1.168.42. Adapt 28 error boundaries to TanStack's unknown error type using existing classified UI copy.
- Patch Vite to 8.1.6, MCP SDK to 1.32.0 and launch-editor to 2.14.2 after the current audit identified additional advisories.
- Normalize CRLF in an existing source-boundary test without removing its security assertions.

## Completed checks

| Check | Result / UTC completion |
|---|---|
| Bun frozen lockfile install, scripts disabled | Exit 0 |
| Dependency audit | Exit 0, empty findings object, 01:44:17 |
| TypeScript | Exit 0, 01:47:13 |
| ESLint | Exit 0, 0 errors / 5 existing warnings, 01:46:02 |
| Vitest | 289 passed, 0 failed, 8 DB tests skipped, 01:45:32 |
| Tooling boundary tests | 10 passed, 0 skipped; includes real Windows junctions and literal argument handling |
| Changed tooling ESLint | Exit 0, no warnings |
| Node production build | Exit 0, 01:49:42 |
| Cloudflare build + Wrangler dry-run | Exit 0, 01:51:05; explicit dry-run exit, no deployment |

Checks used synthetic public Supabase values and an allowlist of OS environment variables,
without owner database credentials. The eight DB checks were not exercised.
The initial sandbox attempt failed before test execution on temporary-file rename permissions;
the unsandboxed authorized run used the same credential-free fixture settings.
The first typecheck identified the unknown-error compatibility changes fixed here.

Advisories:
- https://github.com/advisories/GHSA-qx66-fv34-fjm8
- https://github.com/advisories/GHSA-22jm-h49p-29qw
- https://github.com/advisories/GHSA-587h-7wmj-h5pm

The audit establishes the registry's current result, not absence of every possible vulnerability.
Strix image availability and optional Context7/SkillUI CLI compatibility were not tested;
no scanner, browser installer, external notification, production deployment or DB write ran.

## Remaining deployment and operations evidence

- Existing Cloudflare build 662c5c7c-89a4-453c-aa3c-14f723c577e2 failed on the base commit. GitHub exposes no cause. Local dry-run success cannot establish the remote build command, bindings, credentials or runtime health. The local fixture bundle reports no bindings.
- Supabase project ybhrmcdlgyccywpmiucz reports MIGRATIONS_FAILED. Read-only comparison found 249 local migration files and 286 remote versions, with zero exact version matches.244 remote restore names mention a local original timestamp; names alone do not prove SQL equivalence. No history repair, reset, migration or grant changes were attempted.
- Docker's CLI exists but its dockerDesktopLinuxEngine pipe is absent. No service was started or restarted.
- Neither 4175 nor 5173 had a TCP listener at 01:47:54 UTC, independently checked with netstat. Earlier ERP122 runtime acceptance must not be represented as current service availability.
- Local STORE125 has a 50,000-row / 200-page per-source report guard and a separate failed DB-test environment. This is not monthly 100,000-record reporting or concurrency acceptance. Do not merge it wholesale into this different checkout.
- 100,000 invoices and100,000 accounting operations per month remain an unmeasured capacity target. Prior tests cover small synthetic correctness, restore and contention scenarios only.

Machine-readable logs, source/file hashes and the Arabic capacity evidence are saved alongside the
checkout in `../repair-evidence-20261021/`. No branch was pushed and no deployment was triggered.

## Follow-up: compatible integration on local STORE125

The local integration branch starts from `8691c938e4fa2115fe878b86b7b0d83be7e5118f`.
Its route changes preserve the newer local insurance logic, and report125 files remain unchanged.
The existing CRLF-aware image test is retained. The local lockfile was used as the dependency
update base. Cloudflare's explicit build mode, source entry and generated assets contract were
reviewed together; the ordinary Node and Capacitor configuration paths remain separate.

A repository Vitest configuration keeps all default test discovery, including the five tests
under `src/super-agent/__tests__`, while excluding application build plugins. The initial default
Vite run failed 25 mocked insurance handler assertions because TanStack transformed handlers
into SSR RPC stubs. No assertions were removed to resolve this test-pipeline mismatch.

On 21 October 2026 the combined source passed **508 tests, zero failures and zero skips**
(02:24:37 UTC), including all eight DB security checks. Those checks used the verified existing
synthetic database `ym_claim_atomic113_1792294281244` in the isolated
`ym-store-acceptance-20261015` container, with PostgreSQL read-only transactions enforced.
This is fixture acceptance, not an audit or migration of an owner or production database.
TypeScript passed at 02:25:05, Node build at 02:23:26, Cloudflare build/dry-run at 02:25:06;
the 10 tooling tests, lint and dependency audit also passed. The source-only helper configuration
and private DB wrapper used for verification remain outside the application repository.

After explicit owner approval Docker was started without resets, migrations or security changes.
The established ERP4175 launcher serves ERP122; four fresh-browser UI journeys passed using
intercepted synthetic API responses and zero owner DB requests. Canonical promotion and
post-promotion checks are recorded separately in `../integration-evidence-20261021/`.
The 100,000 invoices plus 100,000 accounting operations per month capacity target remains
unmeasured; the report50,000-row/200-page guard remains in effect.
