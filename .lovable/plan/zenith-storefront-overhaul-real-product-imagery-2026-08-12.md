# Zenith Storefront Overhaul + Real Product Imagery

Full visual/motion rebuild of the public storefront (`/`) into a 3D glassmorphic e-commerce surface, plus a hardcoded real-photo image system so no grey placeholder icons remain anywhere in the store.

## What the customer will see

- A luxury hero with animated mesh-gradient glass, a 3D search bar with live filtering, instant category pills, and floating trust badges ("⚡ توصيل سريع خلال ساعة", "👨‍⚕️ استشارات طبية موثوقة").
- A horizontal-scroll category rail of glass cards, each with its own gradient glow and medical icon, with spring hover/tap physics.
- Product cards with real studio pharma photography, floating badges (الأكثر مبيعاً / خصم خاص / متوفر), active ingredient + short usage line, price tag, and a 1-click "إضافة للسلة 🛒" button with ripple feedback.
- Staggered entrance animations across the page and a floating mobile quick-access bar (RTL, dark-mode aware).
- Nothing from Sun Core / admin / planetary governance appears anywhere on this page.

## Product images

Products come from the database (4,000+ rows), not a static array, so a static per-product array is not workable. Instead:

- New `src/lib/store/product-images.ts`: a curated map of high-resolution Unsplash/Pexels pharma photos grouped by category — vials & injections, tablets & antibiotics, syrups & suspensions, skincare, vitamins & supplements, baby & mother care, general OTC — plus explicit overrides for named products (e.g. روسيفلكس، سيبروفلكس).
- Resolution order per product: `primary_image_url` → `image_url` → explicit name override → category/dosage-form keyword match (Arabic + English) → deterministic pick from the general pool. The keyword matcher reads `dosage_form`, `name_ar/en`, `generic_name`, and `category_id`, so every product resolves to a real photo.
- New `src/components/store/ProductImage.tsx`: glassmorphic shimmer skeleton while loading, `object-contain p-4 mix-blend-multiply` framing with ambient drop shadow, and on network error a rendered 3D gradient medicine-pack fallback card (never a broken icon).

## Technical notes

New components under `src/components/store/`: `HeroBanner.tsx`, `CategoryGrid.tsx`, `ProductCard.tsx`, `ProductImage.tsx`, plus `src/components/store/MobileQuickNav.tsx`.

`src/pages/Storefront.tsx` becomes a thin composer: keeps existing data flow (`listProducts` / `listCategories` via `useServerFn` + React Query, debounced search, `categoryId` state) and existing sections (`OnboardingDocModal`, `PrescriptionUploadModal`, `HealthBundles`), delegating presentation to the new components. Search/category state stays in the page and is passed down.

Add-to-cart wires to the existing `src/lib/cart.functions.ts` path already used by `product.$productId.tsx`; the same `ProductCard` is reused on `/shop` and `/search` so imagery is consistent store-wide.

Motion: Framer Motion variants with `staggerChildren: 0.08`, spring `whileHover={{ scale: 1.05, y: -4 }}` / `whileTap={{ scale: 0.95 }}`. Animations limited to transform/opacity for 60fps, with `prefers-reduced-motion` respected. Colors use existing semantic tokens and glass utilities; no hardcoded hex.

No backend, schema, or RBAC changes — public server functions and column whitelists stay as-is.
