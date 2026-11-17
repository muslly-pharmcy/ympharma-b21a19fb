---
name: pharma-cloudflare-safe-release
description: Verify Cloudflare Worker build, deployment and rollback readiness without altering production.
---

# Cloudflare release guard

1. Determine actual deployment target from `wrangler.jsonc`, CI and dashboard; do not assume Cloudflare/Vercel/Lovable share runtime.
2. Inspect Nitro preset for Worker-compatible output. Check for Node built-ins, `createRequire` in bundles, runtime bindings and environment precedence.
3. Confirm secrets remain server-only; public config has consistent URL/project/key identity; no `VITE_*` service-role credentials.
4. Verify CI frozen Bun dependency installation, lint, typecheck, tests, build and Worker-specific preview where configured.
5. Validate caching headers, CSP/CORS, redirect `www` -> canonical with path+query, domain certificate and logs.
6. Practice staging rollback and record evidence; never infer availability from a successful compilation.
7. Stop on failures. A deployment is gated by real staging smoke tests and clear approval for production release.

Upstream skill registry: https://ehabfayez.com/en/skills/cloudflare-skills ; primary Cloudflare source must be checked separately before installing remote code.
