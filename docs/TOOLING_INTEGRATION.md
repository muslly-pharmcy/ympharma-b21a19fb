# Tooling integration for Playwright, Strix, SkillUI and Context7

This document describes the repository-level integration for developer tools. It is intended for local developer machines and reviewed staging runners only. NEVER run scanners against production systems without explicit, written authorization.

Files and scripts added
- scripts/devtools/tooling-doctor.js         - environment checks
- scripts/devtools/playwright-install.js   - installs Playwright browsers
- scripts/devtools/playwright-smoke.js     - runs Playwright tests (chromium)
- scripts/devtools/skillui-extract.js       - gated SkillUI extraction (requires SKILLUI_ALLOW=1)
- scripts/devtools/ctx7-check.js            - gated Context7 check (requires CTX7_ALLOW=1)
- scripts/devtools/strix-help.js            - local help text
- scripts/devtools/strix-scan.js            - gated Strix Docker scanner (requires SECURITY_STRIX_DOCKER=1 and allowlist entry)
- scripts/devtools/strix-allowlist.json     - allowlist of permitted SCAN_TARGET values

Safe defaults and gating
- Strix: gated and pinned to ghcr.io/usestrix/strix-sandbox:1.3.0. The package command delegates to the same runner. Requires SECURITY_STRIX_DOCKER=1 and an exact entry in the `allowedTargets` array in scripts/devtools/strix-allowlist.json. Targets must exist inside this repository, excluding its root; wildcards and image overrides are rejected. Docker receives argument arrays without a shell. Output is written to ./artifacts/strix-report.json and must be sanitized before sharing.
- SkillUI: gated via SKILLUI_ALLOW=1 and outputs into ./artifacts/skillui
- Context7 (ctx7): gated via CTX7_ALLOW=1

Developer commands (examples)
- node scripts/devtools/tooling-doctor.js
- node scripts/devtools/playwright-install.js
- node scripts/devtools/playwright-smoke.js
- SKILLUI_ALLOW=1 SKILLUI_OUT=./artifacts/skillui node scripts/devtools/skillui-extract.js
- CTX7_ALLOW=1 node scripts/devtools/ctx7-check.js
- SECURITY_STRIX_DOCKER=1 SCAN_TARGET=./staging-scan node scripts/devtools/strix-scan.js

Windows notes
- These scripts are implemented in Node and are cross-platform. Use PowerShell or cmd.exe as appropriate when setting environment variables. For PowerShell:
  $env:SKILLUI_ALLOW = "1"; node scripts/devtools/skillui-extract.js

Artifacts
- All generated artifacts are written under ./artifacts and .gitignored by the project (see .gitignore update).

Offline entrypoint checks: run each of `strix-scan.js`, `skillui-extract.js`, and
`ctx7-check.js` with `--help`. Successful help validates loading only, not a scan,
extraction, or provider connection. Strix also accepts `--dry-run` after opt-in and
target validation; this prints Docker arguments without launching Docker. The
other two wrappers still require separately verified optional provider packages
for real execution. `bun x` is equivalent to `bunx` when the latter alias is absent.

See docs/TOOLING_INTEGRATION.md and SETUP.md for step-by-step installation and safety checklist.
