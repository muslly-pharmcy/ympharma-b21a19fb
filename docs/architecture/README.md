# Architecture and read-only verification

Scope: `muslly-pharmcy/ympharma-b21a19fb`. These tools do not prove runtime readiness, authorization, or RLS correctness by themselves.

## Existing Playwright

The project already contains `playwright.config.ts` and an `e2e` test suite. An opt-in public-entry-only suite is provided in `e2e/read-only-audit.e2e.ts`. It performs GET/navigation only, does not log response bodies, does not attempt login, and does not create test data.

```bash
E2E_BASE_URL=http://127.0.0.1:8765 bunx playwright test e2e/read-only-audit.e2e.ts --project=chromium
```

Only run when the URL points to a target you own and can reach. The localhost URL is local to the machine executing Playwright.

## Dependency analysis

Configuration: `.dependency-cruiser.cjs`. Use a reviewed, pinned compatible `dependency-cruiser` version and add it via Bun's lockfile in a separate dependency-update step. Do not use unpinned `latest` in CI. Example after installing dependency:

```bash
bunx depcruise --config .dependency-cruiser.cjs --output-type err src
bunx depcruise --config .dependency-cruiser.cjs --output-type dot src > architecture.dot
```

Rules detect circular imports, orphan modules, and browser-side direct imports of `*.server.ts` files; these are candidate architectural defects, not security-exploit proof. Review false positives, especially file-based routes and dynamic imports.

## Structurizr

`structurizr/workspace.dsl` is a source-scoped C4 model (system context and containers). Use Structurizr CLI after independently verifying and pinning its version. Diagram relationships are conceptual; deployment credentials, exact data stores, actual RLS enforcement and tenant boundaries have not been validated.

## Supabase security verification (read-only)

Use an approved **read-only database role** and metadata-only SQL against the exact associated Supabase project; do not use a service-role key in the browser or CI logs. The local application has **not** been proven to map to this repository/project.

Recommended checks: inspect pg_policies and pg_class relrowsecurity for exposed tables; confirm grants; compare schema migrations with deployment; verify auth/session boundaries and cross-tenant access through isolated pre-approved fixture accounts. Never infer RLS security from TypeScript-generated `types.ts` alone.

## Acceptance criteria

1. Lockfile-pinned dependency-cruiser installed and architecture analysis runs with agreed baseline.
2. Structurizr DSL validates with a pinned CLI release and renders both diagrams.
3. Playwright read-only suite passes against authorized dev/staging endpoint (record URL/commit/date, without secrets).
4. Supabase metadata findings reviewed and all high-risk RLS/auth findings triaged.
5. CI checks added only after pinned dependencies, baseline and reproducible green runs.

No production data, configuration, deployments or secrets should be modified during the audit.
