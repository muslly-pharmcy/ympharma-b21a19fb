# Muslly SEO implementation — iteration 2

Target: https://muslly.com — public storefront only.
Code branch: fix/muslly-seo-performance-20261114.

## Prior verified baseline
OpenSEO audit 4ad86f75-e2ee-4b25-a72d-5b1a91abbdb0 tested 50 pages and 20 Lighthouse runs.
- Home mobile Lighthouse performance 81/100, LCP 3694 ms, TTFB 1967 ms.
- Home desktop 96/100.
- Home mobile unused JS estimate 233 KiB (large WebGL/React Three Fiber bundle), image delivery savings ~63 KiB, long document request latency.
- 18 short product descriptions; 5 thin-content pages; 11 heading-order observations; six long titles; two long descriptions.
- The old audit started before PR #39 landed; it reported duplicate H1 across 47 pages. Later manual live HTML fetch confirmed one H1 each on / and /shop after PR #39.

## Implemented in this iteration
1. Gate the ambient WebGL animation to wide screens with no reduced motion or data saver; keep static glass gradients for all devices.
2. Use 240px fallback product image variant where supported, with responsive srcset. This reduces mobile overfetch; not all third-party images support width negotiation.
3. Home SSR and client product list initial page reduced from 24 to 8. The full catalog remains available at /shop.
4. Home first product image priority reduced to 2 rather than 4.
5. Correct search descriptions for individual products without calling the regulatory reference price a selling price.
6. Shorten long guide title tags and delivery/guides meta descriptions; restore heading hierarchy for shop card list.
7. Add substantive content to /contact, /request, /tools/bmi, /tools/interactions and /tools/symptoms. Medical information remains informational, not medical advice.
8. Add a daily + manual production SEO smoke action to detect regressions in homepage/shop H1, canonicals, robots, sitemap, noindex and product 404.
9. Cloudflare triage guide at docs/ops/CLOUDFLARE-BUILD-TRIAGE.md.

## Required tests and rollout gates
- CI TypeScript + eslint + unit tests + Node build + Playwright + Cloudflare Worker dry-run.
- Merge PR only after CI green.
- Lovable must sync main SHA before publishing.
- Publish Lovable explicitly and verify live /, /shop, /robots.txt, /sitemap.xml and product 404.
- Run scripts/seo-smoke.mjs against production.
- Rerun Lighthouse after deploy for comparable mobile device and network profile. Only then claim performance-score or LCP improvements.

## Deliberately not marked complete
- Cloudflare external Workers Builds still fail despite prior green GitHub Worker dry-run; requires actual Cloudflare account build logs and configuration.
- Google Search Console ownership/index coverage and sitemap submission require account connection, not just a meta verification tag.
- External backlinks, directory citations and organic Google ranking require measured ongoing work.
- A thorough crawl of all public product pages/links is needed; prior 50-page audit reached its page cap.
- Do not weaken authentication/RLS or release private routes for indexing.
