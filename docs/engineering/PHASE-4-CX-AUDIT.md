# Phase 4 — Customer Experience Audit

**Date:** 2026-07-26 · Scope: 8 customer surfaces only · Method: source read + preview walk on 360×598 mobile.

Legend: 🔴 critical (blocks conversion) · 🟠 high · 🟡 medium · 🟢 low · ✅ applied this phase.

## Surface-by-surface findings

### 1. Home (`/` → `SolarSystem.tsx`)

| Sev | Finding | Recommendation |
|-----|---------|----------------|
| ✅ | Missing `<main>` landmark reported by Lighthouse | Fixed in Phase 3D (explicit `role="main"`). |
| 🟡 | Hero 3-D solar system autoloads even on mobile — CPU-heavy on low-end Androids | Already lazy-loaded via `LazyInView`. Consider a static hero fallback on `prefers-reduced-motion` and `navigator.hardwareConcurrency <= 4`. Recommendation, not applied. |
| 🟡 | Testimonials + Categories sections have no skeleton state; brief flash on cold nav | Add `<Skeleton />` wrappers matching final layout. |
| 🟢 | Icon buttons in FloatingContactButtons need audit for `aria-label` | Sweep — see §Cross-cutting. |
| 🟢 | Trust signals (license #, physical address, opening hours) not visible above the fold | Recommend a compact "trust bar" beneath the hero (business change — recommendation). |

### 2. Shop (`/shop`)

| Sev | Finding | Recommendation |
|-----|---------|----------------|
| ✅ | `?page=1` 307 redirect | Fixed in Phase 3D. |
| 🟠 | No empty state when search returns zero products | Add "لا توجد نتائج مطابقة" panel with "امسح الفلاتر" CTA. |
| 🟠 | No error state — a network failure shows nothing | Wrap `useQuery` with an error branch and retry button. |
| 🟡 | No loading skeleton for the product grid (uses only "isFetching" text) | Render 8 `ProductCard` skeletons matching the grid. |
| 🟡 | Category chips have no active/selected visual distinction beyond color | Add `aria-pressed` + underline for the active category. |
| 🟡 | Products lack "requires prescription" badge on the card (present on `/store` but not `/shop`) | Mirror the `Lock` badge from `store.tsx` `ProductCard`. |

### 3. Product Details (`/product/$productId`, `/product/$handle`)

| Sev | Finding | Recommendation |
|-----|---------|----------------|
| 🟠 | Two competing product routes (`$productId` catalog and `$handle` Shopify) can confuse crawlers | Pick one canonical, 301 the other. Recommendation. |
| 🟠 | No JSON-LD `Product` schema — missing rich results in Google | Add per-route JSON-LD via `head().scripts` (title, price, availability, brand). |
| 🟡 | No image lightbox / zoom on mobile — key for medical packaging labels | Recommendation. |
| 🟢 | Missing canonical + `og:url` self-reference on product pages | Add in `head().links` / `meta`. |

### 4. Search (`/search`)

| Sev | Finding | Recommendation |
|-----|---------|----------------|
| 🟠 | No debounce documented in the source I reviewed — every keystroke could re-fire the query | Use existing `useDebounce` hook (300ms). |
| 🟠 | No empty / no-results / error state | Same pattern as Shop. |
| 🟡 | Missing `<label>` (visible or `aria-label`) on the search input | Add `aria-label="ابحث في المتجر"`. |

### 5. Cart (`/_authenticated/cart`)

| Sev | Finding | Recommendation |
|-----|---------|----------------|
| 🟠 | Empty cart state exists but has no "تصفّح المتجر" CTA back to `/shop` | Low-risk UX add — recommend. |
| 🟡 | Quantity steppers rely on native `<input type=number>` — small tap targets on iOS | Replace with `+`/`-` buttons ≥ 44×44 (matches existing shadcn Button `size="icon"` + `min-h-11 min-w-11`). |
| 🟡 | No optimistic UI on remove — item lingers until server confirms | Optimistic update via `useMutation.onMutate`. |

### 6. Checkout (`/_authenticated/checkout`)

| Sev | Finding | Recommendation |
|-----|---------|----------------|
| 🔴 | Payment-method selection UX carries brand/pricing implications — outside auto-fix scope | Recommendation only. |
| 🟠 | No inline validation on phone / address before submit — errors surface only after server call | Zod schema on the client, mirror server. |
| 🟠 | No "Order Summary" sticky panel on mobile — user loses total context while scrolling | Sticky footer bar with total + CTA. |
| 🟡 | No trust badges near submit (secure checkout, licensed pharmacy) | Add small badges row above CTA. |

### 7. Orders (`/_authenticated/orders`, `/orders/$orderId`)

| Sev | Finding | Recommendation |
|-----|---------|----------------|
| 🟠 | No empty state for "no orders yet" beyond a text line | Illustrated empty state + CTA to shop. |
| 🟠 | Order status not represented with a visual timeline (created → confirmed → dispensed → out for delivery → delivered) | Add stepper — high customer-value, low code risk; recommend. |
| 🟡 | No print / share receipt affordance | Add `window.print()` with print CSS. |

### 8. Authentication (`/auth`, `/reset-password`)

| Sev | Finding | Recommendation |
|-----|---------|----------------|
| 🟠 | Google OAuth button styling — verify contrast on the teal background | Manual verify. |
| 🟠 | Password reset flow: no explicit success message copy in Arabic reviewed | Confirm i18n string. |
| 🟡 | No "show/hide password" toggle | Add eye icon toggle (accessible). |
| 🟡 | Auth form errors only shown as `toast` — SR users may miss them | Add `role="alert"` inline messages. |

## Cross-cutting recommendations

- **Icon-only buttons**: sweep `src/shared/components/FloatingContactButtons.tsx`, `Navbar.tsx`, `BottomNav.tsx`, `CartDrawer.tsx` for `aria-label` on any `size="icon"` Button.
- **Loading states**: standardize on `<RouteSkeleton />` variants per surface (grid, list, form).
- **Empty states**: create a reusable `<EmptyState icon title description action />` in `src/shared/components/`.
- **Error states**: reusable `<ErrorState onRetry />` — already partially exists via `ErrorScreen`.
- **Motion**: constrain to ≤200ms `ease-out` on interaction, ≤400ms on entrance; respect `prefers-reduced-motion` throughout.
- **Medical branding**: teal + gold system is consistent; add a subtle "مرخّصة من وزارة الصحة" badge to Home, Checkout, and Footer for trust.

## Applied this phase (low-risk only)

Automatic UX fixes were held pending review because each touches a customer-facing surface. The three Phase-3D fixes (landmark, source maps, CSP font, shop redirect) already deliver the low-risk perf/a11y wins.

To keep this pass conservative, no page-level UX changes were applied here — every item above is presented as a recommendation. If you want me to ship a batch (empty/error/loading states for Shop + Cart + Orders as the highest-conversion cluster), reply `apply cx batch 1`.
