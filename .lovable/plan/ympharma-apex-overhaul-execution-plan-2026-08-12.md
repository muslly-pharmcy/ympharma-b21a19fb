# YmPharma Apex Overhaul — Execution Plan

Phases 1–3 of the previous Aden-Net pass already shipped (speed-dial, customer-only bottom nav, single-row category rail, pharmacology panel, responsive product imagery, offline query cache). This plan covers what is genuinely missing, plus the polish those shipped pieces still need.

## 1. Storefront performance & isolation (finish the last 20%)
- Glassmorphic restyle of the category rail (`backdrop-blur`, translucent pills, hidden scrollbar) and guaranteed `z-30` clearance for the speed-dial over search/hero on 360px screens.
- Blur-up shimmer placeholders + explicit width/height on every product image to remove layout shift; AVIF source added ahead of WebP.
- Audit public bundles for leaked "Sun Core"/planetary/admin wording and remove it from customer-facing surfaces.
- Confirm every `/admin/*` route sits behind the authenticated gate and redirects visitors home.

## 2. Clinical AI suite
- **Prescription & lab OCR scanner**: new customer component that uploads a photo, calls a server function backed by the Gemini vision model, returns an Arabic summary of medicines/doses/lab values, and offers to add matched catalog items to the cart.
- **Interaction engine**: drug–drug and drug–food (dairy, grapefruit, fasting) safety matrix as a typed local dataset, surfaced in the cart and on product pages.
- **Pediatric dose calculator**: weight + age based, wired into the existing tools hub.
- Extend the pharmacology tree with more systemic classes so out-of-stock items always render the two WhatsApp actions (طلب توفير خاص / بديل فارماكولوجي).

## 3. Family health wallet & trust signals
- Family sub-profiles (name, relation, allergies, chronic conditions, blood type) stored per account with row-level security, managed from the account area.
- Cart cross-check against the selected profile's allergies/conditions with a blocking warning before checkout.
- Authenticity + cold-chain badge on product cards and detail pages, driven by batch data already in inventory.

## 4. Emergency & WhatsApp commerce
- "وضع الطوارئ" header action: acute-medicine picker, optional browser geolocation, high-priority structured WhatsApp payload.
- Standardised WhatsApp order payload (item table, dosages, location link) shared by cart, emergency mode, and out-of-stock requests.
- Back-in-stock alert signup and rewards points display reusing the existing loyalty tables.

## 5. HD catalog expansion
- Extend the image map with studio photography pools for haircare, makeup/fragrance, infant formula stages 1–3, baby hygiene, and maternity supplies so no product falls back to a grey placeholder.

## 6. Sun Core admin intelligence
- Expiry + depletion forecasting panel: flags items projected to run out or expire within 7 days.
- Voice query bar (browser speech recognition) over the existing admin AI orchestrator for sales, out-of-stock, and pending-prescription questions.
- 1-click printable Arabic dosage label for a dispensed prescription.
- Prescription uploads added to the existing Google Sheets stream and the 9:00 PM executive dispatch.

## 7. Integrity pass
- Typecheck clean, RTL verified at 360px, build green.

## Technical notes
- OCR, forecasting, voice-query answering, and WhatsApp payload building run server-side via `createServerFn`; the vision/chat calls go through the AI gateway with `openai/gpt-5.6-sol` unless an image-input model is required.
- Family profiles need one new table with GRANTs, RLS, and owner-scoped policies in the same migration; back-in-stock alerts reuse the notification tables where possible.
- Interaction matrix and pharmacology tree stay as typed local data (no network cost, works offline).

## Assumptions
- Payments stay as-is (WhatsApp/cash on delivery); no new payment gateway is added.
- Rewards surface reads existing loyalty data rather than introducing a new points engine.
