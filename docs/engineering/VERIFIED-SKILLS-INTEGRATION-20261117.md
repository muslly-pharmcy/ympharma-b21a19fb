# Skills integration report — 2026-11-17

## Scope
This branch integrates **five independently authored repository-local SKILL.md workflows** from the saved YmPharma/muslly.com skill pack. The codebase already contains domain skills; none is replaced. Only skill text and its toolkit manifest are modified. No runtime dependency, privileged configuration, migration, production data, or deployment is changed.

## Skills and priority
| Skill | Intended usage |
| --- | --- |
| muslly-commerce-guard | Storefront product visibility, checkout, price and stock synchronization, `ERP_SYNC_ENABLED` |
| pharma-cloudflare-safe-release | Cloudflare Worker-specific safe release and deployment verification |
| pharma-security-audit-gates | Read-only code security, RLS, data isolation, secrets and safe evidence |
| pharma-transaction-acceptance | Financial/FEFO/RLS/concurrency acceptance criteria |
| pharma-webapp-e2e-gates | Playwright, RTL and device/browser evidence for ERP/storefront |

Existing `pharma-pos-fefo`, `pharma-ledger-integrity`, `pharma-supabase-rls`, `pharma-offline-sync`, `pharma-cloudflare-release` and `pharma-release-gate` remain authoritative for their domain. New skills serve as **complementary checklists**, not replacements.

## Upstream verification and non-installation claims
- The supplied video identifies the Cloudflare `security-audit` skill; the advertised **320-item collection was not obtained**. The new local `pharma-security-audit-gates` is not the original Cloudflare skill.
- A separate public directory https://ehabfayez.com/en/skills lists 73 skills; these are **indexed in the user's separate downloadable skill pack**, not installed here. Avoid bulk installing external scripts and prompts without source, license and trust review.
- Relevant sources: https://github.com/cloudflare/security-audit-skill, https://github.com/addyosmani/agent-skills, https://github.com/anthropics/skills.

## Integration mechanism
`.agents/skills/*/SKILL.md` is the repository-local skill location already used here. All five paths were added to `.agent-toolkit/manifest.json`, so `python3 .agent-toolkit/verify.py --repo .` as invoked by `.github/workflows/pharma-ai-toolkit-guard.yml` checks each for presence, path safety and matching frontmatter. The existing `.github/copilot-instructions.md` already instructs agents to use applicable local skills.

## Acceptance and status
1. Static package inspection: five source skill files had matching names and headers before integration (PASS locally on package, not repository).
2. Branch manifest verification: **pending GitHub Actions**; do not claim PASS without logs.
3. CI build/lint/typecheck/unit/E2E and Worker dry-run: **NOT RUN** by this integration operation; verify the PR checks.
4. Application-level tests and production readiness: **NOT RUN**; guidance-only skill installation is not implementation of ERP/store logic.
5. Publish/merge: **NOT DONE**, requires green CI and review; verify actual Lovable/muslly.com deployment-to-repository mapping separately.

## Rollback
Revert the skill-addition commit; original skills and runtime are unchanged. Do not auto-run third-party skill scripts. Never issue real financial postings, inventory corrections or production checkout tests under the guise of a skills smoke test.
