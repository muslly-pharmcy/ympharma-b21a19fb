# ER-OS Hardening + WhatsApp Ordering + AI Invoice OCR

Scope confirmed: orders stay recorded in the database AND the customer is auto-redirected to WhatsApp. Phases 4-5 (glass UI, Bento, PWA, Capacitor, voice) get a targeted polish pass only — no rebuild.

## 1. Security & privacy hardening

- Audit custom database views and switch them to caller-based security so each viewer only sees rows their permissions allow.
- Tighten access rules on prescriptions and stock tables so data never crosses between pharmacies/branches.
- Extend the existing redaction utility to cover patient names, medical record numbers, phone numbers and prescription text before anything reaches logs or error reporting, and route the AI safety filter through the same shared pattern list (today the two files duplicate patterns).

## 2. WhatsApp order dispatch

- On confirming an order the app still creates the order record (so tracking, admin dashboard and stock reservation keep working), then immediately builds a WhatsApp message.
- Message is Arabic-first, structured: order number, each line item with quantity, unit price and a direct image link, delivery details, and the grand total.
- The browser (or the native app) opens `wa.me/967782878280` with the message pre-filled. A visible fallback link is shown if the popup is blocked.
- A secondary "اطلب عبر واتساب" button on the cart page for customers who prefer to skip the form.

## 3. AI capabilities

- **Social assistant** at `/marketing/social-assistant`: generates Arabic captions, hashtags and CTAs per platform (TikTok, Instagram, Facebook, X) from live inventory, offers and new arrivals; copy-to-clipboard and share buttons.
- **Invoice scanner** at `/purchasing/scan-invoice`: capture or upload a supplier invoice photo, run it through the existing vision service, extract supplier, date, line items, batch numbers, expiry dates, quantities and costs, show an editable review table, then create a draft purchase order on approval. Reuses the existing invoice upload/line-item tables.
- **Clinical interactions**: dispensing screen cross-checks the drug interaction matrix and shows severity badges (منخفض / متوسط / مرتفع) with details on tap.
- **Kernel evolution** at `/admin/kernel-evolution`: reads recent telemetry and produces reorder-threshold and optimisation proposals for admin approval.

## 4. Visual & mobile polish (targeted)

- Apply the existing glass/Bento tokens to the screens that still use flat cards (store, orders, pharmacist dashboard).
- Add staggered list and page-transition motion where lists are long.
- Make the 3D hero react to cursor/touch, pause when off-screen, and drop resolution on low-end devices.
- Verify safe-area insets and touch-target sizes on the remaining mobile screens; confirm the barcode scanner and push registration wiring in the Capacitor config.

## Technical notes

- Database changes ship as one migration: `security_invoker = on` on custom views, tenant-scoped policies on `hc_prescriptions` / `inv_stock_batches` / `inv_stock_movements`, plus grants.
- WhatsApp payload builder lives in `src/lib/whatsapp/order-message.ts` (pure, typed, unit-testable); checkout calls it after `placeOrder` resolves.
- New routes: `src/routes/_authenticated/marketing.social-assistant.tsx`, `purchasing.scan-invoice.tsx`, `admin.kernel-evolution.tsx`, each with typed server functions in `src/lib/*.functions.ts` behind `requireSupabaseAuth` and role checks.
- OCR extraction runs through `src/lib/ai/vision.server.ts` with a Zod-validated JSON schema; failures return a localized message via the existing safe-boundary wrapper.
- Redaction consolidates on `src/lib/observability/pii-patterns.ts`; `pii-filter.server.ts` re-exports from it to avoid drift.
- No changes to existing route paths, contexts, or exported APIs; strict TypeScript, no `any`.
