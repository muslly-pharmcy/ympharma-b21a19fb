# Aden-Net Zenith Overhaul: Speed, Beauty Catalog, Mobile Cleanup, Pharmacology

Frontend-focused overhaul of the public store: faster on weak connections, real HD cosmetics photography, one floating button instead of three, a customer-only bottom nav, and an academic drug-information layer on product pages.

## Phase 1 — Weak-connection speed (Aden-Net)

- All product imagery served through the existing smart image component with `loading="lazy"`, `decoding="async"`, explicit width/height to stop layout shift, and Unsplash `fm=webp` (AVIF where supported) at mobile-appropriate widths plus a `srcset` so phones never download desktop-size files.
- Persist the React Query cache to IndexedDB (localStorage fallback) so the catalog, categories and recent searches render instantly on repeat visits and while offline; cached data shows immediately and refreshes in the background.
- Keep skeleton shimmers for first paint; only animate transform/opacity so scrolling stays smooth on low-end phones.

## Phase 2 — Full cosmetics & beauty catalog with real photos

Extend the image-resolution engine (`src/lib/store/product-images.ts`) with dedicated high-definition pools and Arabic/English keyword matching for:

- Skincare: cleansers, vitamin C / hyaluronic serums, sunscreens, moisturizers, anti-aging creams
- Haircare: medical shampoos, anti-hairloss serums, oils, masks
- Makeup & fragrance: lipsticks, foundations, micellar water, perfumes, beauty tools
- Mother & child: infant formula, diapers, baby creams, bottles, maternity care

Every URL is verified to return 200 before shipping. No grey vector placeholder remains for any beauty item; the graceful fallback is a rendered gradient packaging card, never a broken icon.

## Phase 3 — Mobile UI cleanup

- **One speed-dial**: replace the three-icon floating dock with a single button at the bottom-right (`z-30`) that expands to WhatsApp, AI assistant, and prescription upload. It sits clear of the hero, search bar, category pills and the bottom nav.
- **Customer-only bottom nav**: the current bar exposes التحليلات and الصرف to visitors. Replace with الرئيسية · المتجر · السلة (with live counter badge) · رفع الوصفة · حسابي. Staff links move out of the public bar entirely.
- **Category row**: single-line horizontal scroll (`overflow-x-auto`, no scrollbar, snap) instead of a wrapping block of pills.

## Phase 4 — Clinical pharmacology reference

New `src/lib/medical/pharmacology-tree.ts`: an academic taxonomy (system → pharmacological class → mechanism of action) mapped to active ingredients, with indications, dosage guidance and pregnancy category. Product pages gain a "المعلومات الدوائية" panel driven by the product's active ingredient / generic name.

For an item that is out of stock, the same panel still shows full drug information plus two WhatsApp actions: "طلب توفير خاص" (prefilled special-order request) and "البحث عن بديل فارماكولوجي" (same-class alternatives listed from the tree, linked to in-stock products where they exist).

## Phase 5 — Admin isolation

Audit the public storefront, nav, footer and floating menu for any Sun Core / النظام الكوني / analytics wording or links; remove them from public surfaces. `/admin/sun-core` and other admin routes stay untouched and fully functional for authenticated admins.

## Technical notes

- Files touched: `src/lib/store/product-images.ts`, `src/components/store/ProductImage.tsx`, `src/components/store/CategoryGrid.tsx`, new `src/components/store/FloatingMenu.tsx` (replacing `src/shared/components/FloatingContactButtons.tsx` usage in `MainLayout`), `src/shared/components/BottomNav.tsx`, new `src/lib/medical/pharmacology-tree.ts` + a `PharmacologyPanel` component used by `src/routes/product.$productId.tsx`, and query-cache persistence in `src/shared/components/AppQueryProvider.tsx`.
- No database migrations, no server-function signature changes, no RBAC/policy changes. The pharmacology tree is static reference data bundled with the app and lazy-loaded on product pages so it costs the storefront nothing.
- Strict TypeScript, RTL throughout, semantic color tokens only.
