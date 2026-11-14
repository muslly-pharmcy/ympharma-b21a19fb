# Cloudflare Workers Builds triage (YmPharma)

## Facts confirmed from GitHub checks — 2026-11-14

The **external** Cloudflare checks `Workers Builds: ympharma-b21a19fb` and `Workers Builds: agent-readiness` failed on the source main SHA 731459ae007d3451d623c766bfe40c4ba4ac89ba. Earlier main commits also showed failures. In contrast GitHub CI completed `WORKERS_CI=1 bun run build` and `bunx wrangler deploy --dry-run` successfully on PRs #38 and #39. That narrows the issue to a difference between external Workers Builds configuration/environment and the validated CI target; it does **not** prove a specific cause.

## Safe investigation

1. In Cloudflare dashboard open **Workers & Pages → ympharma-b21a19fb → Builds**. Inspect the first error of the failed build, not just the GitHub summary. Repeat for `agent-readiness` (this appears to be a distinct Worker; verify it was intentionally linked to this ERP repository).
2. Check each Worker's Git integration: repository, production branch, root directory, framework preset, installed Bun/Node version, build command, deploy command and inherited env vars. Root should be the repository root unless documented otherwise.
3. Prefer explicit Worker command `bun run build:cloudflare` (sets `CLOUDFLARE_BUILD=1` through `scripts/cloudflare-target.mjs`). The ordinary `bun run build` targets Node/Lovable unless `WORKERS_CI=1` is supplied. Use `bunx wrangler deploy` for deployment only after a successful build; inspect Cloudflare platform-specific UI expectations first.
4. Use the repository's `wrangler.jsonc` with `@cloudflare/vite-plugin` (not a Node Nitro output). Do not replace `wrangler.jsonc` with unverified settings or commit credentials.
5. Confirm secrets and bindings in Cloudflare dashboard using secret names only, never export secret values into CI logs.
6. If `agent-readiness` points at the wrong repo/branch, correct its Git integration in Cloudflare dashboard; do not disable or delete a Worker without verifying ownership and purpose.
7. After the dashboard change, rerun that Worker's build. Require a successful published build **and** smoke checks of the Worker endpoint before marking it operational.

## Known-good local/CI reproduction
```sh
bun install --frozen-lockfile
WORKERS_CI=1 bun run build
bunx wrangler deploy --dry-run
# alternate explicit target
bun run build:cloudflare
```

**Deployment boundary:** The public site `muslly.com` is published through Lovable. Fixing its SEO source does not require repointing production DNS to Cloudflare or changing Supabase/database credentials.

## Blocker

Cloudflare build logs and dashboard configuration have not been made available through the connected tools. Until a failed external build log is inspected, the root cause remains **unconfirmed**. Do not report this as fixed solely because the dry-run succeeds.
