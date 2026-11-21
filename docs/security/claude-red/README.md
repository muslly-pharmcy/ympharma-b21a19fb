# Claude Red — defensive only, for YmPharma and muslly.com

Six original, non-offensive Agent Skills have been added under `.agents/skills/safe-*`; read `POLICY.md` before activating them. The upstream methodology is SnailSploit/Claude-Red pinned to commit `6196ba7464662de34e8744d359f175d1a7bca530` (MIT); original offensive source files and `install.sh` are not imported.

## Evidence-backed review scope
- `src/routes/api/chat-widget.ts`: reject unsupported client message roles, bound histories and preserve server-owned AI instructions.
- `drizzle/migrations/0005_erp_integration_foundation.sql` vs `0006_erp2_org_scoped_foundation.sql`: legacy/v2 boundary analysis only; NEVER apply migrations to production.
- Supabase RLS: cashier, branch, org and prescription/patient boundaries.
- Storefront: only approved/public products, server-owned prices, prescription gates, checkout idempotency and one stock decrement per sale.
- Offline: device quotas, per-user private cache and replay; 500-cashier stock stress test requires disposable Postgres and separate authorization.
- `package.json` still contains `security:strix:docker` pointing at `latest` and a writable mount. DO NOT run it. Review existing PR #18 before introducing a pinned, gated replacement.
- Independent source mapping for the production site `muslly.com` remains NOT_VERIFIED.

## Verification
1. Inspect diff against `main`.
2. GitHub CI: `bun install --frozen-lockfile`, `bunx tsc --noEmit`, `bunx eslint . --max-warnings=0`, `bunx vitest run`, `bun run build`.
3. Capture exact CI run URL, SHA, status and failing command. Existing green CI is not test evidence for this PR.
4. No merge/deploy/production data changes without independent review.
