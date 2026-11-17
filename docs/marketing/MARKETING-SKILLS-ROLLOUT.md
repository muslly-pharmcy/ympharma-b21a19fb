# Marketing Skills rollout — muslly.com

## Source and inventory
- Upstream: https://github.com/coreyhaines31/marketingskills
- Pinned upstream commit: `1f837447b20bb6f0e72d87b80ece1c221c362c7d` (v2.14.12, 2026-11-17 retrieval).
- Count: **53** `SKILL.md` entries, including their source references, templates and optional scripts inside the submodule. The entire source is available after `git submodule update --init`.
- License: MIT (inspect upstream `LICENSE` before redistribution).
- Integration: external source pinned at `.agents/marketingskills`; domain-specific context at `.agents/product-marketing.md`; orchestrator `.agents/skills/muslly-marketing-integration/SKILL.md`.

## Set up on Windows / Linux / Codex
```bash
git clone --recurse-submodules https://github.com/muslly-pharmcy/ympharma-b21a19fb.git
cd ympharma-b21a19fb
bash scripts/install-marketing-skills.sh
# Alternative Codex marketplace:
codex plugin marketplace add coreyhaines31/marketingskills
# In an interactive Codex session, open /plugins and install marketing-skills
```

The script will not change any existing pharmacy agent skill; it skips conflicts and prints counts. Upstream optional scripts MUST be security-reviewed before execution. Skill installation in the repository is distinct from installation into an individual ChatGPT account (not supported by this GitHub change).

## First concrete site change
- Removed SEO snippets suggesting continuously updated prices or unverified payment/shipping options from `src/routes/shop.tsx`.
- Updated the snippets to state that actual prices and product availability are confirmed during order review.
- Added a source-level regression test.

## Prioritized implementation backlog
1. **SEO and copy accuracy**: measure existing homepage, shop and product metadata using the project's SEO suite; check the production sitemap, search console index coverage and local queries.
2. **CRO**: measure anonymous click-through from home to `/shop`, product detail interaction, and contact/order-intent; do not track diagnosis, medicine purchase profiles or prescription payloads.
3. **Arabic content**: create pharmacist-reviewed guides and category descriptions without unsupported benefits or promises.
4. **Schema**: validate `Pharmacy` and public `Product` JSON-LD; never add `Offer` or `InStock` from reference prices or unconfirmed stock.
5. **Campaign readiness**: require verified legal/ad-platform eligibility, opt-in and privacy assessment before ads, WhatsApp broadcasts or user segmentation.

## Acceptance checks
- 53 pinned upstream skills verified by the installer; no overwrites of existing agent skills.
- `src/routes/shop.tsx` passes the new source-level copy regression test.
- Run `bun run test`, `bun run build` and existing SEO smoke checks on CI **before merging**.
- Manual production SEO and delivery validation after deployment; no automatic promotion based solely on this PR.

## What this does NOT claim
No claims of live site publication, ad campaign launch, analytics account linkage, production conversion uplift, or global ChatGPT-account skill installation.

## Verified cloud installation — 2026-11-17
- GitHub Actions workflow **Materialize pinned Marketing Skills** completed successfully on the feature branch.
- All **53** upstream skill entrypoints are now checked in at `.agents/skills/<skill>/SKILL.md`, alongside the existing **14** Pharma AI and integration skills (**67 total**).
- All **460** upstream files inside `skills/` are versioned in `.agents/skills/`.
- Post-install GitHub object-SHA comparison: **460 of 460 identical** to upstream commit `1f837447b20bb6f0e72d87b80ece1c221c362c7d`, no missing or mismatched files.
- The MIT license is preserved in `.agents/skills/LICENSE.marketingskills`.
- Ongoing regression check: `.github/workflows/marketing-skills-integrity.yml` checks the pinned git submodule, all copied file bytes and existing Pharma AI skills.
- This proves source installation in the GitHub project. It does **not** imply publishing the SEO change to the live website, installing the skills globally in ChatGPT, or running untrusted upstream scripts.
