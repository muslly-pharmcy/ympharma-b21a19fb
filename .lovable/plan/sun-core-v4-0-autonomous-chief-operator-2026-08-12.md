# Sun Core v4.0 — Autonomous Chief Operator

Upgrade the existing AI Runtime Kernel (v3.0) into an orchestrating operator: it watches every module, syncs customer data to your Google Sheet in real time, emails you a daily executive report at 9:00 PM, keeps the daily health-content engine running, and self-heals runtime errors.

Assumptions confirmed: report email goes to `dr-mohmed@muslly.com` (your registered owner address), WhatsApp summary targets `782878280`, sheet is `1UnYdgwEk6OZbui3gQ42rn_Tx2R6d68AOP9eITqAmMhQ`, writes happen through your connected Google account.

## 1. Google Sheets real-time CRM bridge

- Link your Google Sheets connection to the project, then add a server-side bridge that appends one row per event: `[Full Name, Phone, Order/Inquiry Details, Category, Date & Time]`.
- Triggers wired at: new customer registration, order placed (web + WhatsApp checkout), and inquiry/medical-request submission.
- Every attempt is written to a `crm_sync_log` table (status, row payload, error) so nothing is lost silently; failures are retried by the daily worker.
- Add a `GOOGLE_SHEETS_WEBHOOK_URL` override setting, editable from the Kernel Evolution admin page, so you can repoint the sync to a webhook later without a code change.

## 2. Daily executive dispatcher (9:00 PM)

A scheduled background worker compiles:
- Visitors, average dwell time, tool usage (from analytics + engagement events)
- New registrations and the Sheets sync log summary
- Sales volume, pending OCR purchase orders, safety-stock alerts
- Health/promotional content generated that day

It renders a modern RTL Arabic HTML email (brand shell, glass-style cards) and sends it to your address, and produces a 1-click WhatsApp summary link for `782878280`. The same report is viewable in the admin UI.

## 3. Planetary orchestration + telemetry

- A kernel telemetry registry records health, latency, error rate, and budget usage for each module (Inventory, Clinical, OCR, Social, CRM, Analytics, Tools).
- The Sun Core reads this registry when routing, and an admin panel shows a live planetary status board.

## 4. Daily social content + self-healing

- Confirm/adjust the existing social generator to produce exactly 3 unique Arabic posts per day under clinical safety rules, logged and visible in the marketing assistant.
- Self-diagnostics loop: runtime/API errors are caught by module-level fallback boundaries, classified, auto-mitigated where possible (retry, cache fallback, degraded mode), and escalated to the report when not.

## 5. Human-in-the-loop approvals

Financial transactions, inventory approvals, and clinical overrides route to the existing approvals queue and surface as 1-click glass approval cards in the admin hub.

## Technical notes

- New: `src/lib/integrations/google-sheets/` (gateway client + row mapper), `src/lib/reports/daily-dispatcher.server.ts`, `src/lib/ai/runtime/telemetry.server.ts`, report email template in `src/lib/email-templates/`.
- Cron: two `pg_cron` jobs (21:00 report, hourly sync-retry) calling `/api/public/hooks/*` routes guarded by the existing cron-auth middleware.
- Migration adds `crm_sync_log` and `kernel_module_telemetry` with GRANTs, RLS, and org-scoped policies in the same migration.
- Sheets calls run server-side through the Lovable connector gateway; no keys reach the browser.
- Strict TypeScript, RTL layout, glassmorphism tokens already in `index.css`.

## Out of scope

No new storefront/checkout logic, no third-party ad or analytics vendor, no marketing/bulk email — the daily report is a single-recipient operational email.
