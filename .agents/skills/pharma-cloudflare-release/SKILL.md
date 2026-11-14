---
name: pharma-cloudflare-release
description: Validate the exact Cloudflare Workers deployment target, preview isolation, and non-production release gates for YmPharma.
---

# Cloudflare release engineering

- Read `AGENTS.md`, `wrangler.jsonc`, `vite.config.ts`, `scripts/cloudflare-target.mjs` and the latest failed Workers Builds logs before proposing a fix.
- Worker identity must remain `ympharma-b21a19fb`; `agent-readiness` is a different Worker, not an alias to rename or override.
- Workers builds must select Cloudflare Vite via `WORKERS_CI=1` or `CLOUDFLARE_BUILD=1`. Node/Nitro builds are not Worker builds.
- Keep `previews: {}` defined. Preview binding credentials must be isolated from production; validate the actual source commit and Worker name.
- Run frozen install, unit/browser regression, `bun run build:cloudflare`, and `bunx wrangler deploy --dry-run`; classify each log as PASS/FAIL/BLOCKED/NOT RUN.
- Verify the actual hosted Preview with read-only health, SSR and catalog requests before asking to publish. Dry-run alone cannot certify production.
- Never print credentials or set live DNS, production secrets, aliases, or deployment without scoped approval and rollback.
