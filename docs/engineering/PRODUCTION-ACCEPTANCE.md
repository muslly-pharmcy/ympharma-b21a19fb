# MUSLLY AI OS — Production Acceptance Report

**Target:** https://muslly.com (custom domain) · fallback https://ympharma.lovable.app → 302 → muslly.com
**Date:** 2026-07-26
**Verdict:** ⛔ **NOT ACCEPTED — CRITICAL production incident**

A live browser probe of production shows the customer-facing site is broken
below the navbar. The published JS bundle throws before the app can hydrate,
so `/` and `/shop` render the error boundary. A republish from a green build
is required before acceptance can be reconsidered. All engineering-owned
issues in the previous certification remain resolved; this is a build/deploy
regression, not a code regression.

---

## 0. Executive Summary

| Area | Result |
|---|---|
| Route reachability (edge) | ✅ 200 on all public routes |
| Security headers / HSTS / CSP-RO / XFO / Referrer / Permissions-Policy | ✅ Present |
| CSP `upgrade-insecure-requests` in report-only | ⚠️ Ignored by browsers (report-only limitation) |
| Public webhook auth (WhatsApp verify token) | ✅ 403 on wrong token |
| Chat widget (`POST /api/chat-widget`) | ✅ 200, Arabic reply returned |
| Client-side hydration of `/` and `/shop` | ⛔ Error boundary — Supabase env missing in published bundle |
| Newer server routes (`event-consumer`, `dlq-reprocessor`, `/api/public/health`) | ⚠️ 404 — not present in current published deployment |
| Bundle size (gzip) main JS | ✅ 184 KB main + small route chunks |
| Home DCL / FCP (Chromium, DE edge) | ✅ 1.93 s / 1.96 s |
| Cross-browser matrix (Firefox / Safari / Edge) | ⚠️ Not runnable in this sandbox — Chromium only |
| Sentry / GA4 / Meta review | ⚠️ Owner-blocked (documented in FINAL-CERTIFICATION.md) |

---

## 1. End-to-End Production Verification

### 1.1 Public routes (edge, no JS)
All 200, served from Cloudflare. TTFB 0.09–1.67 s.

```
/                       200
/shop /cart /about /contact /auth /offline   200
/sitemap.xml /robots.txt /manifest.webmanifest 200
```

### 1.2 API / webhooks
| Endpoint | Method | Result |
|---|---|---|
| `/api/chat-widget` | POST | ✅ 200, streams Gemini Arabic reply |
| `/api/public/hooks/whatsapp` (bad verify token) | GET | ✅ 403 (Meta HMAC/verify path enforced) |
| `/api/public/hooks/event-consumer` | POST | ⛔ 404 in production (route exists in repo — build not deployed) |
| `/api/public/hooks/dlq-reprocessor` | POST | ⛔ 404 in production (same cause) |
| `/api/public/health` | GET | ⛔ 404 in production (route not shipped) |

### 1.3 Supabase / storage / uploads
Not exercisable without a signed-in session against production. Verified in
repo: RLS enabled + policies on every public table, GRANTs present,
storage buckets created via tool, `invoice-extractions` bucket exists,
FEFO RPC atomic (`public.checkout_cart_fefo`).

### 1.4 Cron endpoints
`pg_cron` schedules for agent activation (every 12h) and the DLQ
reprocessor SQL script (`docs/engineering/sql/schedule-dlq-reprocessor.sql`)
are documented. Owner still needs to install the DLQ schedule.

### 1.5 Social integrations
- WhatsApp Cloud API: verify handler live and correctly rejecting bad tokens; app review still pending Meta side (owner action).
- No live credentials available for Instagram / GA4 in this environment; not exercised.

---

## 2. Browser Validation

Executed under headless Chromium 1280×1800 and mobile 390×844 (iPhone UA).
**Firefox, Safari, Edge, and real device labs are not available inside this
sandbox** and must be run from the owner's environment (BrowserStack /
Sauce or manual).

| Viewport | URL | Screenshot | Result |
|---|---|---|---|
| 1280×1800 | / | rendered navbar only, hero blank | ⛔ Client crash after hydration |
| 390×844   | /shop | error boundary shown ("حدث خطأ غير متوقع") | ⛔ Same root cause |

### Root cause (production bundle)
Published main JS `/assets/index-qca62FCE.js` was built without
`VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` being replaced.
The bundle still references the raw string names `SUPABASE_URL` /
`SUPABASE_PUBLISHABLE_KEY`, and `createSupabaseClient()` throws:

```
Error: Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY.
Connect Supabase in Lovable Cloud.
```

`.env` in the repo has both `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` set, so a fresh publish will bake them in
and restore the site. This is a stale-deploy regression, not a code
regression — `src/integrations/supabase/client.ts` is auto-generated and
untouched.

### Console/runtime issues observed on production
- CSP `upgrade-insecure-requests` warning (report-only mode is expected to ignore it — safe to drop that directive from the RO policy).
- Repeated `[Supabase] Missing …` errors before the error boundary catches.
- No third-party script errors; no mixed content; no CORS violations.

---

## 3. Performance Validation (Chromium, current production build)

| Metric | Home | Shop |
|---|---|---|
| Navigation TTFB | 1316 ms | 98 ms (warm) |
| First Contentful Paint | 1964 ms | 232 ms (warm) |
| DOMContentLoaded | 1933 ms | — |
| Total load event | 2108 ms | 221 ms |
| gzip HTML | 17.6 KB | ~11 KB |
| Main JS gzip | 184.6 KB | shared |
| CSS gzip | 14.3 KB | shared |

CLS / INP / true LCP cannot be reported because the LCP element never paints
— the app crashes at hydration. **Re-run after republish.**

Slowest DB query still tracked: client `error_logs` inserts (mean 8.93 ms).
Write batching (ADR-0002) already merged; expected to drop insert QPS ~10×
once redeployed.

---

## 4. Security Validation

Response headers on `/`:

- ✅ `strict-transport-security: max-age=31536000; includeSubDomains`
- ✅ `x-content-type-options: nosniff`
- ✅ `x-frame-options: DENY`
- ✅ `referrer-policy: strict-origin-when-cross-origin`
- ✅ `permissions-policy` locked down (camera/mic/geo/usb all `()`)
- ⚠️ `content-security-policy-report-only` (not enforced) — recommend promoting to `content-security-policy` after 7 days of clean CSP reports; drop `upgrade-insecure-requests` from RO policy (browsers ignore it there).
- ✅ Cloudflare bot cookie set; no server banner leak beyond `server: cloudflare`.

Endpoint auth spot-checks:
- WhatsApp webhook: rejects wrong verify token (403). HMAC path enforced in code (`src/routes/api/public/hooks/whatsapp.ts`).
- Chat widget: accepts JSON body, does not require auth by design (public assistant); rate limiting / abuse control relies on `public-endpoint-guard.server.ts`.
- Cron routes (`event-consumer`, `dlq-reprocessor`): return 404 in production because they're not shipped yet; when redeployed they enforce `cron-auth` middleware.
- No admin routes reachable without session (all `/admin-*` behind `_authenticated` layout).

No new pen-test findings. Prior scan findings (`hc_doctors_public_read_qr_token_phone`, `product_classifications`, `agent_approval_requests`) remain resolved via safe views and forced `auth.uid()` columns.

---

## 5. Infrastructure Validation

| Item | Status |
|---|---|
| Custom domain (`muslly.com`) A + TXT | ✅ Active, HTTPS auto-issued |
| Backup domain (`ympharma.lovable.app`) → 301 to `muslly.com` | ✅ (302 observed, acceptable) |
| Env vars in repo `.env` | ✅ `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` present |
| Published bundle env baked in | ⛔ **Missing — see §2 root cause** |
| Health endpoint | ⛔ `/api/public/health` returns 404 (not in current deploy) |
| Rollback readiness | ⚠️ Republish reverts to latest commit; no explicit "roll back to previous published build" self-serve on Lovable — document manual git revert + republish as the rollback path |
| Backups | ⚠️ Owner-only (Cloud → Advanced → Export data); no automated off-Lovable backup configured |
| DR runbook | ❌ Not written — see §6 recommendations |
| Sentry DSN | ❌ `VITE_SENTRY_DSN` not set (owner action) |

---

## 6. Production Acceptance

### 6.1 What was verified
- Edge routing, security headers, sitemap/robots/manifest, chat AI, WhatsApp verify handler, static assets, bundle size, headless-Chromium rendering, mobile viewport rendering, CSP presence, HTTP response codes on public routes.

### 6.2 What could NOT be verified (missing credentials / owner permissions)
- Authenticated flows end-to-end (no production test user handed over).
- Storage upload against production bucket.
- Firefox / Safari / Edge / real iOS / real Android (no browser matrix in this sandbox).
- Sentry error ingestion (DSN not set).
- GA4 events, Meta WhatsApp review completion.
- Live Stripe / payment webhooks.
- Meaningful Core Web Vitals — the app crashes before LCP paints.

### 6.3 Residual operational risks
1. **CRITICAL — Live site broken below the navbar.** Republish required.
2. **HIGH — DLQ replay cron not installed** on production Postgres. Any failed event will queue but never drain.
3. **HIGH — No `VITE_SENTRY_DSN`.** Client crashes go to `error_logs` only, not to a paging channel.
4. **MEDIUM — Health endpoint 404** in current deploy; external uptime probes should target `/robots.txt` until republished.
5. **MEDIUM — No documented rollback runbook** — mitigate via git tag on every green publish.
6. **LOW — CSP still report-only.** Promote after 7 days of clean reports.

### 6.4 Deployment checklist (before republish)
- [ ] Confirm `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` present in Lovable project env.
- [ ] `tsgo --noEmit` green (already verified locally).
- [ ] `196/196` tests green (already verified).
- [ ] Security scan: zero unresolved critical findings.
- [ ] Tag current `main` HEAD (`baseline-v1.1-YYYYMMDD`) for one-command rollback.
- [ ] Publish via Lovable Publish dialog.

### 6.5 Day-0 (launch day) checklist
- [ ] Hit `/`, `/shop`, `/cart`, `/auth`, `/about`, `/contact` on desktop + mobile — expect full render, no error boundary.
- [ ] Hit `/api/public/health` — expect 200 JSON.
- [ ] `curl -X POST /api/public/hooks/event-consumer` without cron header → 401.
- [ ] Send a real WhatsApp verify request from Meta dashboard → 200 + challenge echoed.
- [ ] Place one end-to-end order (guest → cart → checkout → order confirmation) with test data.
- [ ] Confirm order visible in `/admin-orders` and FEFO batch decremented.
- [ ] Confirm chat widget returns Arabic reply on mobile.

### 6.6 Day-1 (T+24h) checklist
- [ ] Review `public.error_logs` — expect batched inserts, no repeated Supabase-init errors.
- [ ] Review `agent_events` DLQ table — expect drain if events queued.
- [ ] Review `cron.job_run_details` for the last 24h — no run failures.
- [ ] Review Lovable analytics: request count, 4xx/5xx ratio.
- [ ] Confirm no CSP reports of unexpected origins (once promoted to enforce).
- [ ] Confirm Google Search Console indexing of `/`, `/shop`, `/about`, `/contact`.

### 6.7 Day-7 monitoring checklist
- [ ] Slow-query top 10 (`supabase--slow_queries`) — no new outliers > 100 ms mean.
- [ ] DB size + connection pool utilisation < 60%.
- [ ] Storage bucket growth vs. quota.
- [ ] Agent run success rate ≥ 99% over the week.
- [ ] Zero unresolved critical / high security findings.
- [ ] Promote CSP report-only → enforce if reports are clean.

### 6.8 Recommended KPIs and alerts

| KPI | Threshold | Channel |
|---|---|---|
| 5xx rate | > 1% over 5 min | Sentry / on-call |
| Chat widget error rate | > 5% over 15 min | Sentry |
| `/api/public/health` failure | 2 consecutive misses | UptimeRobot → email/WA |
| `agent_events` DLQ depth | > 100 rows | Slack / email |
| `error_logs` insert rate | > 10× baseline over 10 min | Slack |
| Checkout success rate | < 95% over 1 h | Slack |
| Slowest DB query mean | > 100 ms | Weekly digest |
| Storage growth | > 20% week-over-week | Weekly digest |

---

## 7. Final Verdict

**⛔ Production is NOT accepted at this moment.**

The last published deployment is broken for end users. The fix is a
republish — no code change is required, because the repository is already
in the certified state (Composite Score 92/100, 196/196 tests, zero
engineering-owned criticals). After republishing:

1. Re-run §6.5 (Day-0 checklist).
2. Re-run §2 headless-browser check on `/` and `/shop` — expect full render.
3. Re-run §1.2 API matrix — expect 200 on `/api/public/health` and 401 (not 404) on cron routes without headers.

Once those three checks pass, this project can be marked
**Production Accepted — v1.1**.
