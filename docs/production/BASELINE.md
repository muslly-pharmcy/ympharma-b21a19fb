# YMP-001 — baseline, 2026-11-15

Status: **G0 BLOCKED; G1 NOT STARTED.** This is source inspection, not production acceptance.

## Identity

- Authorized repository: `muslly-pharmcy/ympharma-b21a19fb`.
- `git fetch origin` and `git ls-remote origin HEAD` verified main at `949a63bd511381e82efc67616bb0a3159a2e9025`, matching the supplied Graphify report commit.
- Original checkout: `D:/YmPharma/ympharma-git`, clean, HEAD `2d63d4e0`. Its October tests and migrations are NOT evidence for current main.
- Isolated worktree: `D:/YmPharma/execution-20261115`; branch `codex/ymp-001-baseline-20261115`.
- Read root AGENTS.md and .github/copilot-instructions.md. No application behavior or migration changed.
- `config/public-backend.ts` and `supabase/config.toml` agree on `ybhrmcdlgyccywpmiucz`. This identifies the configured backend, not its deployed schema or active deployment SHA.
- No separately identified staging database, verified backup or restoration evidence was available.

## Tool and environment observations

- GitHub and Supabase connector calls returned `MCP tool ... is not available to the model`.
- Initial `gh repo view` and `gh pr list` failed with `gh auth login` required. Reusing the existing Git credential non-interactively subsequently allowed `gh api repos/muslly-pharmcy/ympharma-b21a19fb`; repository identity and push permission were verified. An intermediate GraphQL request timed out during TLS handshake. No credential was printed or persisted.
- Docker `docker ps` failed: `dockerDesktopLinuxEngine` pipe not found. No daemon was started and no existing container altered.
- No `supabase`, `psql`, or globally installed `graphify` executable found. Repository Graphify helper is available under `.agents/skills/graphify`.
- Root runtime is Node 26.13.0; CI specifies Node 22. Bun is 1.4.3.
- Repository has bun.lock and package-lock.json; CI uses `bun install --frozen-lockfile`. Treat bun.lock as the reproducible CI dependency input; no lockfile changed.

## Gate decision

The execution plan explicitly requires explained schema drift, an independent test environment and a proven restore before progressing to G1. Those prerequisites are not satisfied. A local database invented from a subset of migrations would not establish the actual backend schema. Prepare and review G1 only after collecting the metadata in SCHEMA_DRIFT.md and completing RESTORE_PLAN.md.

See TEST_RESULTS.md for executed commands, RISK_REGISTER.md for verified findings and IMPLEMENTATION_REPORT.md for remaining tasks.
