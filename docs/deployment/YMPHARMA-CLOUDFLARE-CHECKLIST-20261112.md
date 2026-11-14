# Cloudflare Workers Builds — exact required settings (2026-11-12)

## What is verified

- GitHub CI passes `WORKERS_CI=1 bun run build` and `bunx wrangler deploy --dry-run`. This does **not** prove Cloudflare-hosted builds succeed.
- Cloudflare checks for both `ympharma-b21a19fb` and `agent-readiness` failed on PR #25; detailed build logs were not accessible through the connected GitHub tools.
- This repository's `wrangler.jsonc` has Worker name `ympharma-b21a19fb`. Cloudflare's current documentation requires an exact Worker name match. `agent-readiness` is a **different** Worker: it cannot safely publish the same Wrangler configuration without explicitly separate deployment config/connection.
- This change adds the mandatory `previews: {}` block for `wrangler preview`. Never inherit production secrets into preview by default.

## Set in Cloudflare dashboard (Settings → Build)

For Worker **ympharma-b21a19fb**, using GitHub `muslly-pharmcy/ympharma-b21a19fb`:

| Setting | Expected value |
| --- | --- |
| Root directory | repository root |
| Production branch | `main` |
| Build command | `bun run build:cloudflare` |
| Deploy command | `bunx wrangler deploy` |
| Preview command | `bunx wrangler preview` |
| Package manager | Bun `1.4.3` from `package.json` |
| Worker name | `ympharma-b21a19fb` |

**Important:** do not change the live production Worker settings or retry publish until Cloudflare build logs and source mapping are reconciled, and a Preview is tested using separate non-production credentials. The repo's `bun run build` is **Node/Nitro** and must not be used to build a Worker.

For **agent-readiness**: verify which repository/config is intended. If the same root `wrangler.jsonc` is being used, the Worker name mismatch will fail. Either disconnect the unintended build integration or create a separate, reviewed Wrangler config and command for that Worker; do not rename the production YmPharma Worker to satisfy an unrelated service.

## Acceptance gates

1. Retrieve the exact failed build logs; classify whether the root cause is Worker-name mismatch, wrong command, missing preview config, permissions, secret bindings, timeout or another issue.
2. Preview build completes for the exact PR SHA, and initial SSR/catalog/health/auth route smoke tests use non-production backend.
3. Compare `wrangler whoami` identity and destination Worker without printing credentials. Avoid any production deployment during PR review.
4. Record Preview URL, bundle SHA, staging data project, build log outcome and rollback procedure.
5. Confirm `ympharma.vercel.app` remains associated with `dahsamtransport-source/pharmacy-erp`; do not silently repoint or overwrite that domain.

References:
- https://developers.cloudflare.com/workers/previews/configuration/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://developers.cloudflare.com/workers/ci-cd/builds/troubleshoot/
