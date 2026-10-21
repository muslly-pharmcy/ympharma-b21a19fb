# Developer tooling

These ESM wrappers run from the repository root even when invoked from another directory.
Bun owns the lockfile. Install project dependencies with `bun install --frozen-lockfile`.

## Local checks

- `bun run tooling:doctor`: checks Node, Bun, Git and the Playwright declaration. Missing Docker or PowerShell 7 is informational; a missing required tool fails.
- `bun run test:tooling`: isolated regression tests for argument handling, opt-in gates, path boundaries and ignored environment files. No scanner, database or external service is invoked.
- `bun run playwright:smoke`: runs existing Chromium E2E tests against `E2E_BASE_URL` (default localhost:8080). Use an isolated test server and synthetic identities.
- `bun run playwright:install`: explicitly installs browsers using the already installed Playwright CLI. Add `--with-deps` only when system dependency installation is intended.

## Optional tools

Help commands print local instructions without contacting a registry:
`bun run ctx7:help`, `bun run skillui:help`, `bun run security:strix:help`.

Context7 and SkillUI are optional and are not installed automatically. Review and install an appropriate version locally before enabling their wrappers. `CTX7_ALLOW=1` permits the Context7 connectivity check; `SKILLUI_ALLOW=1` permits directory extraction. `SKILLUI_OUT` defaults to `artifacts/skillui` and must remain within `artifacts/`, including after junction/symlink resolution. The integrations' external CLI compatibility still requires a real authorized smoke check.

## Strix

`security:strix:docker` calls the guarded wrapper. It requires both `SECURITY_STRIX_DOCKER=1` and an exact `SCAN_TARGET` entry in `scripts/devtools/strix-allowlist.json`:

```powershell
$env:SECURITY_STRIX_DOCKER = '1'
$env:SCAN_TARGET = './staging-scan'
bun run security:strix:docker
```

Stage only approved, sanitized code in that directory. URLs, wildcards, repository-root scans and paths escaping the checkout are rejected. The selected directory is mounted read-only at `/work/target`; only `artifacts/strix` is writable for reports. The entire repository and its environment files are not mounted.

The existing image pin is `ghcr.io/usestrix/strix-sandbox:1.3.0`. Other image overrides, including `latest`, are rejected. Image availability and scanner CLI compatibility have **not** been verified by the local boundary tests; review the image before an authorized scan. Reports may contain sensitive source details and remain ignored by Git.

## Cloudflare validation

`bun run validate:cloudflare` builds locally and invokes Wrangler with fixed `deploy --dry-run` arguments. It rejects every additional argument before resolving dependencies or building. It does not deploy a Worker. A successful local build does not establish that the remote build configuration, runtime bindings or credentials are correct.

Environment files, dependencies, local Supabase metadata, browser reports and artifacts are ignored. Only explicitly sanitized `.env.example` / `.env.*.example` templates are allowed.
