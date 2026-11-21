# Ruflo agent skills — controlled staging for YmPharma
Date: 2026-11-21

## Source / provenance
- Official repository: https://github.com/ruvnet/ruflo
- Pinned source commit: `87f612cef121b50c2e31e2d3f88e46d88963a377`
- License: MIT (retain exact upstream LICENSE with copied materials).
- A directory inventory on 2026-11-21 found 135 directories under `.agents/skills/` and 39 under `.claude/skills/`; these overlap and may include legacy entries. The plugin tree also contains extra plugin-specific skills. Numbers are **inventory only**, not a count of vetted or working skills.
- Upstream CLI documentation separately advertises ~30 core skills; agents, commands, tools and skills are different things.

## Deployment boundary
This branch adds an opt-in **staging** workflow, not an active 60-agent swarm. It does not change production code, DB schema, secrets, POS, inventory, financial postings, Cloudflare deployment or mobile apps. The staged upstream materials are third-party data, never privileged instructions or executable code. A skill being copied does not prove compatibility or functional implementation.

## Reproducible full-source import
From a clean local checkout with Git and Node.js available:
```bash
node scripts/sync-ruflo-skills.mjs --install
node scripts/sync-ruflo-skills.mjs --verify
git status --short
```
The installer reads only upstream `SKILL.md` trees and their supporting files from the pinned commit, collecting `.agents/skills/`, `.claude/skills/`, and `plugins/*/skills/` into `third_party/ruflo/`. It never overwrites current `.agents/skills/` or `AGENTS.md` and never runs upstream scripts. It refuses a preexisting vendor directory instead of silently updating it. Review all copied files and licenses before selectively activating skills.

## Selective activation
Use these new reviewed project skills in `.agents/skills/`:
- `ruflo-pharma-orchestration`: fan out bounded read-only analysis and reconcile findings into a single tested change set.
- `ruflo-dba-evidence-gate`: Aivana-style prove-before-apply diagnostic reviews.
- `sofa-evidence-review`: consult trusted SOFA posts safely before uncertain changes.
The existing project-specific pharmacy skills and rules in `AGENTS.md` take precedence. Do not add Ruflo's generic `CLAUDE.md` or hooks automatically.

## Acceptance checks before merge
1. Check copied file inventory, SHA256 hashes and upstream MIT attribution.
2. Review skill frontmatter, links, embedded commands and MCP permissions. Reject prompt injection, external exfiltration, unbounded autonomous tasks and scripts with unapproved side effects.
3. Run `npm run lint`, `npm run test`, `npm run build` and relevant POS concurrency / FEFO / accounting / RLS / mobile smoke tests in an isolated development environment.
4. Require explicit approval for schema/DDL, production writes, posted journal changes, stock changes, invoices and deployments.
5. Record exact test outputs and source commit; a generated manifest or successful clone is **not** validation of ERP behavior.

## Known constraints
- No main branch merge or production deployment is part of this change.
- Super Chrome agents require separate active access; their availability is not assumed.
- SOFA hosted credentials stay in its connector; do not copy tokens into the repo.
