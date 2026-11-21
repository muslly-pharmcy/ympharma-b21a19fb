# Actual verification results — 2026-11-15

Worktree `D:/YmPharma/execution-20261115`, base `949a63bd`. No runtime code modified. Logs named below are local ignored artifacts at worktree root.

| Command / check | Actual result | Interpretation |
| --- | --- | --- |
| git fetch origin; git ls-remote origin HEAD | PASS, 949a63bd511381e82efc67616bb0a3159a2e9025 | Current remote source identity |
| bun install --frozen-lockfile --ignore-scripts | Incomplete; stopped after sustained stall | No locked installation success |
| Retry with --network-concurrency 8 | Incomplete; stopped after registry timeout diagnosis | No package or lock changes committed |
| curl.exe -I --max-time 15 https://registry.npmjs.org/tinyrainbow | Exit 1, curl error 28 after 15023ms | Network connection timed out; not proof of registry-wide outage |
| node node_modules/vitest/vitest.mjs run --exclude 'artifacts/**' --exclude 'e2e/**' | Exit 1, missing tinyrainbow | Runner did not start; zero verified Vitest cases |
| node node_modules/typescript/bin/tsc --noEmit | Exit 2; missing modules and downstream type errors | Incomplete dependency tree; cannot attribute these to source defects |
| node node_modules/vite/bin/vite.js build | Exit 1, missing rolldown | Build BLOCKED by installation |
| node node_modules/eslint/bin/eslint.js . --max-warnings=0 | Exit 2, missing eslint-visitor-keys | Lint BLOCKED by installation |
| Bun focused source/fixture tests (below) | 32 PASS, 8 SKIP, 0 FAIL | Alternate runner; source checks and synthetic fixtures only |
| Bun domain tests (below) | 30 PASS, 2 FAIL / 2 errors | Two suites cannot use vi.hoisted under Bun; not an accepted Vitest replacement |
| Python SHA-256 verification | PASS, 261/261 local SQL hashes match MIGRATION_MANIFEST.json | Supabase 254 + Drizzle 7; local files only |
| Python journal comparison | PASS, reproduced unjournaled 0006_erp2_org_scoped_foundation | Finding verified, not repaired |
| docker ps | Missing Docker daemon pipe | SQL fixture/concurrency/restore tests BLOCKED |
| PostgreSQL metadata script | NOT RUN | No authenticated connection to verified target/staging |
| Playwright/browser | NOT RUN | Build prerequisite blocked; no production browsing used as a substitute |

## Exact alternate-runner commands

```powershell
bun test tests/internal-service-rpc-grants.test.ts tests/internal-maintenance-rpc-grants.test.ts tests/security-definer-rpc-grants.test.ts tests/legacy-accounting-inventory-rpc-grants.test.ts tests/security-grants-regression.test.ts tests/catalog-import-review.test.mjs tests/ympharma-synthetic-workload.test.mjs
bun test tests/inventory-commands.test.ts tests/insurance-tenant-isolation.test.ts tests/organization-record-scope.test.ts tests/catalog-media-service.test.ts tests/erp-v2-reconciliation.test.ts tests/erp-v2-signature.test.ts tests/erp-v2-uncertain-replay.test.ts
```

First log: baseline-bun-focused.log. The 8 database checks skip without DATABASE_URL. Second log: baseline-bun-domain.log. Errors are in catalog-media-service and erp-v2-uncertain-replay at vi.hoisted. No failed assertion was weakened or test removed. Other logs: baseline-install.log, baseline-vitest.log, baseline-typecheck.log, baseline-build.log, baseline-lint.log.

## Graphify — executed successfully

`python .agents/skills/graphify/scripts/run.py build` exited 0 using graphifyy[sql] 0.9.108. Output: 858 code files, 5,579 nodes, 11,962 edges, 373 communities. Local-only extraction, zero model tokens. The working tree includes the new G0 metadata probe/manifest, so counts are not asserted identical to the supplied November 14 analysis (856/5,578/11,962/372).

Four partial-extraction warnings: android/app/build.gradle, android/app/capacitor.build.gradle, android/build.gradle, src/integrations/supabase/types.ts. Also 129 code files yielded no symbols and 32 files were unclassified. 137 edges are inferred; ignore rules exclude environments, secrets, dependencies and skill/toolkit directories. Neither this graph nor static grant tests prove live authorization.

Executed affected queries, exit 0:
- setProductStockBalance → admin-inventory.tsx → routeTree.gen.ts.
- bulkImportExcel → AdminExcelImport/admin-excel-import.tsx → routeTree.gen.ts.

Generated graph and report remain ignored in graphify-out; original source findings were independently confirmed by text search. No sensitive application data was used.
