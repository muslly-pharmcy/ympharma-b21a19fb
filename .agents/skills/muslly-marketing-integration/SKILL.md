---
name: muslly-marketing-integration
description: Use the pinned Marketing Skills collection for ethical, evidence-based Arabic pharmacy e-commerce marketing work on muslly.com, with strict prescription, price, inventory, and data privacy safeguards.
---

# Muslly marketing integration

1. Read `.agents/product-marketing.md` first.
2. Read the relevant upstream skill in `.agents/marketingskills/skills/<skill-name>/SKILL.md` (or installed copies at `.agents/skills/<skill-name>/SKILL.md`).
3. For site work, prioritize `seo-audit`, `schema`, `ai-seo`, `copywriting`, `cro`, `analytics`, `content-strategy`, `site-architecture`, and `conversion-tracking`.
4. Verify every claim against production pages, catalog eligibility and owner-approved pharmacy policy. Avoid fictitious product claims, sale prices, inventory, unlicensed diagnoses, guarantees or testimonials.
5. Do not send prescription data, order identities, customers' health information, or sensitive search terms into advertising or analytics.
6. Draft changes on a feature branch and run existing SEO tests and app build before merge. No automatic deployment or paid campaigns.
7. Record findings with objective evidence, acceptance criteria, test output, and next action.

## Materialization

The full 53-skill source is pinned as a Git submodule at `.agents/marketingskills`. After checking out the project, run:

```bash
bash scripts/install-marketing-skills.sh
```

This copies the skill folders (including their references/assets) into `.agents/skills` for agents that scan only the direct skills directory. Existing skills will not be overwritten. Audit external scripts before running.
