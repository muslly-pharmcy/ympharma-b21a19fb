# Product Marketing Context — muslly.com
Status: internal context; reviewed from public site and project source 2026-11-17.
Last source checked: https://muslly.com and `src/shared/branding.ts`.

## Identity and audience
- Brand: صيدلية المصلي / Almosly Pharmacy.
- Website: https://muslly.com/.
- Locale: Aden, Yemen; Arabic RTL first.
- Offering visible on site: browsable pharmacy catalog, prescription review, confirmation of item availability and price, local delivery requests, supporting information tools and AI information assistant.
- Primary audiences: people in Aden searching for pharmacy items, personal care, vitamins, skin care, and pharmacy order/review services.
- Key conversion actions: browse catalog (/shop), request pharmacist review, contact pharmacy, request delivery. Define GA4 events only after owner approval and with no medical/patient identifiers.

## Verified-safe positioning
- Suggested message: "تصفّح المنتجات الصحية واطلب مراجعة صيدلية وتأكيد السعر والتوفر قبل توصيل طلبك داخل عدن".
- Do not claim current stock, guaranteed delivery time, live price, professional diagnosis, verified therapeutic outcomes, or offers unless independently confirmed.
- An official reference price is not a confirmed selling price. Never use structured-data Offers with unconfirmed price/availability.
- Prescription items require pharmacist review; do not promote bypassing prescriptions, controlled-drug sales, or unsafe self-medication.

## Marketing guardrails
1. Accuracy: use verified on-site facts only. No fabricated testimonials, doctors, partnerships, medical efficacy, discounts, review scores or addresses.
2. Privacy: analytics and ads may not capture medical details, patient IDs, prescription content, diagnosis, search strings containing protected health data or sensitive segments.
3. Customer consent: no unsolicited SMS/WhatsApp or email automation without lawful opt-in and opt-out.
4. Publication: all copy, promotions and ads require human review for medical compliance before going live.
5. SEO: preserve canonical URLs, robots exclusions, approved public catalog filter, pharmacy JSON-LD, and sitemap. Avoid indexing private pages.
6. Site workflow: changes require tests, PR review, and deployment validation; installing an agent skill alone does not modify the live website.

## Approved first-pass workflows
- Audit SEO metadata, structured data, sitemap and performance.
- Improve factual Arabic storefront copy, information architecture and internal links.
- Design privacy-safe event schema for browse/search/order-interest without personal or medical data.
- Propose A/B tests and customer journeys; do not claim conversion lift without measured evidence.

## Relevant sources
- src/routes/index.tsx
- src/routes/shop.tsx
- src/routes/product.$productId.tsx
- src/routes/__root.tsx
- src/routes/sitemap[.]xml.ts
- tests/seo-public-indexability.test.ts
