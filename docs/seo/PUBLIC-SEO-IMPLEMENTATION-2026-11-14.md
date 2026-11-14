# Muslly Pharmacy public SEO audit — 2026-11-14

Scope: `https://muslly.com` public storefront and information pages in `muslly-pharmcy/ympharma-b21a19fb`. No changes to protected ERP, VOLTA, Oracle integrations or production data.

## Changes in this branch

- Home page: only one primary H1 across the glass hero and store hero.
- Head tags: default absolute Open Graph/Twitter image uses an existing 512px PNG and Arabic alt text; a bespoke 1200x630 image is a future creative improvement.
- Canonicals: added the shop's canonical, retaining the existing homepage/about/article canonical tags.
- Sitemap: removed noindex authentication and internal-search pages; added the public policies page; retains only approved and public product records for product URLs.
- Crawling: robots.txt still references the existing dynamic XML sitemap and now avoids API/MCP endpoints.
- Index policy: internal site search, login, password recovery and authenticated application areas are noindex.
- Product structured data: removed an inaccurate InStock/Offer assertion derived from the regulatory **reference** price. Genuine availability and sale prices must be sourced from a server-confirmed public offer before exposing them as Offer schema.
- Added a code regression test at `tests/seo-public-indexability.test.ts`.

## State of the 20 source-video tasks

| Item | Implementation / required verification |
| --- | --- |
| Remove incorrect noindex | Preserved indexability of public home/shop; noindex retained where appropriate on account/search pages. Verify deployed HTTP response. |
| Meta titles/descriptions | Already present on examined public routes; extend uniqueness audit across the full catalogue. |
| Image alt text | Found descriptive alt in hero/product components; audit other images, especially dynamic assets. |
| Core Web Vitals | Needs live Lighthouse/PageSpeed measurement on representative desktop/phone devices. Do not claim success until field data is measured. |
| Sitemap XML | Existing dynamic sitemap corrected; verify HTTP 200, Content-Type and expected URLs after deployment. |
| Open Graph image | Added default absolute PNG image; optional branded 1200x630 redesign pending. |
| Broken links | Requires crawl of deployed routes and third-party links; not certified by a static grep. |
| Heading hierarchy | Fixed confirmed duplicate home H1; audit every other route separately. |
| Backlink strategy | Ethical local citations: verified Google Business Profile, approved pharmacy/health directories, legitimate partner references. No paid/spam links. |
| URL slugs | Existing routes preserved to avoid breaking links. Future slug migration requires mapped 301/308 redirects and stable IDs. |
| Internal links | Navigation already links store, guides, delivery and policy pages; check orphan pages during crawl. |
| Canonical tags | Existing route canonicals retained; shop canonical added. Verify SSR HTML. |
| Enforce HTTPS | The live homepage is currently accessed at https://muslly.com; verify redirects, TLS, www/non-www DNS and HSTS with hosting provider. |
| Compress images | Optimized logo WebP already in sources; full image-budget audit and conversion of public product assets pending. |
| Schema markup | Existing Organization, WebSite, Pharmacy, MedicalWebPage, Product schema; corrected misleading offer availability. Validate output with Google Rich Results Test. |
| Search Console | A verification meta tag already exists in root head, but domain ownership/Google account verification cannot be inferred. Confirm in the owner's Search Console. |
| One H1 per page | Confirmed and corrected home duplicate, checked via source regression test. |
| robots.txt | Existing crawler policy extended to machine endpoints; validate live URL after deployment. |
| Mobile responsiveness | Responsive classes exist, but real device test and visual checks remain. |

## Required post-deployment checks

1. Check HTTP status and response headers of `/`, `/shop`, `/about`, `/policies`, `/robots.txt`, and `/sitemap.xml`; ensure no redirects to login on public pages.
2. Parse `sitemap.xml` and verify it does not include login, internal search, private dashboards, failed/unapproved products or URLs returning errors.
3. Inspect rendered HTML for canonical, robots, title, description, OG image, one primary H1; check non-existent product pages for noindex and a proper 404 response.
4. Test local schema at https://validator.schema.org/ and Google Rich Results Test; do not advertise products as in stock solely because a reference price exists.
5. Run `bunx vitest run tests/seo-public-indexability.test.ts`, `bunx tsc --noEmit`, `bunx eslint . --max-warnings=0`, and `bun run build` in CI.
6. In Google Search Console, confirm domain verification; submit `https://muslly.com/sitemap.xml` and inspect indexing on `/`, `/shop`, `/delivery/aden` and one approved product.
7. Run PageSpeed Insights mobile/desktop on the same pages and make a separate image/JavaScript/CLS performance fix PR based on measured bottlenecks.
8. Verify deployment source. GitHub code updates are not proof that the current Lovable-hosted public site rebuilt from this repository.

## Safety

`robots.txt` is crawl guidance, **not** authorization or data security. SSR-disabled authenticated routes, private APIs and database RLS remain protected by their existing application security controls. Avoid publishing private health records, user-specific data, checkout details or API credentials into metadata, sitemap or structured data.
