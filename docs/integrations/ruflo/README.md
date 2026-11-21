# Ruflo pinned skill inventory and integration policy

Upstream: https://github.com/ruvnet/ruflo
Source revision: 87f612cef121b50c2e31e2d3f88e46d88963a377
Inventory includes all 403 distinct SKILL.md file paths found in the upstream tree; 134 skills are featured in the upstream skills.sh.json across 34 groups. Files may duplicate concepts across .agents, .claude, plugins and v3.

## What is integrated now
- Full inventory with Git blob hashes and original paths in .agent-toolkit/ruflo/catalog.json.
- Local ruflo-skill-router agent skill for safe task-specific routing.
- A separated policy allowing archive-only staging rather than enabling every third-party tool.
- No Ruflo runtime, new package, hook, autonomous process, MCP server or production deployment is activated by this commit.

## Security and adoption
1. Preserve all original pharmacy, finance, inventory, and Lovable integration constraints.
2. Download only content from the exact pinned upstream revision and verify every Git blob SHA-1.
3. Stage third-party skill documents under .agent-toolkit/ruflo/vendor, not under an active skills directory.
4. Run source-aware SkillSpector and manually inspect selected SKILL.md files plus related executable scripts.
5. Activate only approved task-specific skills under a separate branch, with least-privilege tools and data access.
6. Measure time, test quality and cost on a non-production test workload before enabling multi-agent swarms.
7. Do not automatically enable federation, browser-login, autopilot, cron workers, stock/accounting writes, IoT firmware, trading agents, or privileged cloud integrations.

## Recommended project-specific profiles
YmPharma: security-scan, safety-scan, test-gaps, diff-analyze, ddd-context, adr-review, sparc-spec, observe-trace.
VOLTA: browser-test, test-gaps, workflow-create, security-scan, observe-metrics, memory-search.
QuoteLLM: safety-scan, dependency-check, harness-mcp-scan, test-gaps, cost-budget-check.

## Follow-up validation
Review the inventory and staging tool, run syntax checks, stage an exact revision in a disposable local checkout, hash-verify its contents, scan selected skills, then run existing project CI.
All third-party skills remain INACTIVE until specifically reviewed; the inventory is not evidence of functional installation or deployment.
