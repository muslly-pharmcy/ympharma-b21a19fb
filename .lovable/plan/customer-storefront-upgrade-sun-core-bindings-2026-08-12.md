# Customer Storefront Upgrade + Sun Core Bindings

Adds six customer-facing features to the public store and wires each one back into the Sun Core admin panel, Google Sheets sync, and the 9:00 PM executive report — with no admin/"Sun Core" wording visible to visitors.

## Phase 1 — Public storefront

**AI Health Assistant (floating widget)**
- New `src/components/store/AiHealthBot.tsx`: glassmorphic RTL floating panel, bottom corner of the storefront.
- Reuses the existing `/api/chat-widget` endpoint with a clinical-safety system prompt (indications, general dosing guidance, drug safety, always "not a substitute for a pharmacist/doctor", emergency number).
- Replaces the current generic chat widget on public pages so there is only one assistant.

**Health tools**
- New `/tools/bmi` (BMI + daily hydration target) added to the tools hub.
- Existing `/tools/pediatric-dose` and `/tools/interactions` get storefront entry points (a "أدوات صحية" strip on the home page) — no rebuild of working tools.

**Prescription upload**
- New `src/components/store/PrescriptionUploadModal.tsx`, opened from a navbar button and a hero CTA.
- Camera/file capture → upload to a private `prescriptions` storage bucket → record saved server-side → builds a 1-click WhatsApp message containing name, phone, notes and a time-limited signed image link.

**Refill subscriptions & bundles**
- One-click "تذكير إعادة التعبئة الشهرية" toggle on product pages in chronic categories (pressure, diabetes, vitamins); collects name + phone/WhatsApp and stores a monthly refill request.
- Health bundles: curated packages (skincare set, immunity pack, …) with a bundle price, shown as a section on the storefront and openable as a bundle detail card that adds all items to the cart.

## Phase 2 — Sun Core bindings

- New admin route `/admin/prescriptions` (inside the authenticated area): tabs for prescription uploads, refill subscriptions, and bundle orders; status workflow (جديد / تمت المعالجة / مغلق), signed-link preview, WhatsApp reply shortcut.
- AI telemetry: assistant sessions/messages and calculator usage recorded through the existing module telemetry, surfaced on `/admin/sun-core` as new counters. Nothing is rendered for public visitors.
- Every new prescription, refill lead, and bundle order goes through the existing Google Sheets sync queue and appears in the 9:00 PM email/WhatsApp executive report as new sections.

## Phase 3 — Separation & quality

- Public pages keep e-commerce language only; no "النظام الكوني"/"Sun Core"/metrics anywhere public.
- All new tables get GRANTs + RLS: anonymous visitors may insert their own request rows only, reads restricted to staff/admin via `has_role`; storage bucket private with signed URLs.
- Strict TypeScript, full RTL, glass styling from existing tokens, no new console errors.

## Technical notes

- Database migration: `store_prescription_uploads`, `store_refill_subscriptions`, `store_health_bundles` + `store_health_bundle_items`, `store_bundle_orders`, and `ai_widget_events` (all with timestamps, updated_at trigger, GRANTs, RLS). Seed bundle rows in the same migration.
- Storage: private `prescriptions` bucket, signed URLs generated server-side.
- Server functions in `src/lib/store-requests.functions.ts` (public inserts, rate-guarded) and `src/lib/store-requests.admin.functions.ts` (admin reads/status updates, `requireSupabaseAuth` + role check).
- Sheets: reuse `src/lib/integrations/google-sheets/sync.server.ts` with a category per request type.
- Report: extend `daily-dispatcher.server.ts` with prescription/refill/bundle counts.
- Gemini Enterprise connector is not required for these flows; the assistant runs on the existing Lovable AI gateway. Say so if a Gemini Enterprise-grounded search is wanted instead.
