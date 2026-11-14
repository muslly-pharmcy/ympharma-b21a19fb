# Pharma AI repository guidance

Read existing AGENTS.md and any more-specific instructions first; these remain authoritative.
Use relevant project skills under .agents/skills for audits, edits, security and releases.
Start with observed code/config, not assumptions; label PASS, FAIL, BLOCKED, NOT RUN based on evidence.
Change only this repository and use reviewed branches. Preserve working CI, generated files, Lovable history, database boundaries and published secrets.
Do not merge, deploy, post accounting entries, change production inventory or run SQL migrations without explicit scoped authorization.
User-facing reports in Arabic; identifiers, commands and code may use English.

## Verified-work protocol (2026-11-14)

- For behavior changes, first reproduce the defect with a focused failing regression test; change minimal code; rerun it and the full available suite. Do not claim RED/GREEN without command output.
- For cross-module work, record a brief spec, affected interfaces, acceptance tests, deployment/rollback boundaries, and separate each independently reviewable change.
- Prefer the existing project skills and CI over importing an entire third-party skills framework or duplicating packages.
- External ChatGPT plugin connections are **not** repository installations. Never claim PostHog, Context7, Superpowers, or any hosted tool is instrumented in this application until code, configuration and observed events/tests prove it.
- Analytics and diagnostics must use an approved allowlist. Never emit credentials, tokens, prescription/patient records, free-form medical notes, exact location traces, accounting entries, bank details, or private API bodies to third-party telemetry. Confirm collection policy and retention before enabling analytics.
- No direct-to-production writes for testing. Distinguish source/config inspection from executed tests; treat missing evidence as NOT RUN or BLOCKED.

- Privacy boundary: treat analytics as opt-in until a reviewed event allowlist, data minimization and retention policy are evidenced in the running application.

## Graphify project maps

Use `.agents/skills/graphify/SKILL.md` for architecture and dependency queries.
Build and refresh with the bundled helper before relying on a stale graph.
Graph evidence supplements source inspection and tests; it does not replace them.
