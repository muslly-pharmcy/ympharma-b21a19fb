# Wave C — Enterprise Security Hardening

## Phase 1 — Shipped ✅
See git history / previous doc revision.

## Phase 1.5 — CSP Modernization — Shipped ✅

### 1. Tightened CSP directives (still Report-Only)
File: `src/lib/security/headers.server.ts`
- Removed `https:` catch-alls from `img-src` and `connect-src`.
- Explicit third-party allowlist (`THIRD_PARTY_HOSTS`):
  - `https://ai.gateway.lovable.dev` — Lovable AI Gateway (connect-src)
  - `https://fonts.googleapis.com` — Google Fonts stylesheets (style-src)
  - `https://fonts.gstatic.com` — Google Fonts binaries (font-src)
- Supabase origin + realtime WebSocket derived from env at request time.
- `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` — locked.

### 2. CSP violation reporting endpoint
File: `src/routes/api/public/csp-report.ts` (POST)
- Accepts legacy `application/csp-report` and Reporting API (`application/reports+json`).
- Body cap: 16 KB, defensive JSON parse, logs via `console.warn` → visible in server-function logs.
- Wave F (Observability) will persist + aggregate reports.

CSP now emits:
- `report-uri /api/public/csp-report` (legacy compatibility)
- `report-to csp-endpoint` + `Report-To` header (modern Reporting API)

### 3. Third-party resource inventory
| Category | Host | Directive | Notes |
|---|---|---|---|
| Backend API | Supabase project origin | `connect-src`, `img-src` | Derived from `SUPABASE_URL` at request time. |
| Realtime | Supabase WSS | `connect-src` | Same origin, `wss://` scheme. |
| AI Gateway | `ai.gateway.lovable.dev` | `connect-src` | Server-to-server (rarely browser), whitelisted defensively. |
| Fonts (CSS) | `fonts.googleapis.com` | `style-src` | Kept explicit; only active if a route adds a `<link rel=stylesheet>` to Google Fonts. |
| Fonts (binary) | `fonts.gstatic.com` | `font-src` | Same as above. |
| Assets | `data:`, `blob:` | `img-src`, `font-src`, `media-src`, `worker-src` | Required for icons, generated PDFs, canvas exports. |

Analytics, error trackers, tag managers, and marketing pixels are **not** currently loaded.
If added later, they must be appended to `THIRD_PARTY_HOSTS` in the same PR.

### 4. Nonce deferral — engineering rationale
Per-request `script-src 'nonce-<value>'` is the correct end state but is deferred
until it can be shipped correctly. Reasons:

1. **Framework plumbing.** TanStack Start's `<Scripts />` component renders the
   SSR hydration bundle tags automatically. It does not currently expose a
   documented per-request `nonce` prop that survives hydration without a script
   attribute mismatch.
2. **Hydration mismatch.** A nonce injected only at SSR would render one set of
   `<script nonce="…">` tags server-side and a different (nonce-less) DOM
   client-side, tripping React's hydration warning on every navigation.
3. **`'unsafe-inline'` is inert under Report-Only.** The current policy does not
   block anything; leaving `script-src 'self' 'unsafe-inline'` in place while
   the rest of the policy tightens is safe.

**Path forward** (recorded, not shipped):
- Option A — wait for framework-level nonce support in `<Scripts>`.
- Option B — swap to hash-based `script-src` for the small number of inline
  bootstrap scripts once we have a stable hash inventory.
- Option C — Trusted Types (`require-trusted-types-for 'script'`) as a
  compensating control; requires refactoring any DOM sinks (`innerHTML`,
  `document.write`) — audit needed first.

We will not flip CSP from Report-Only to enforce until one of the three ships.

### 5. Trusted Types
Deferred. Recommend evaluating during Wave C.5 penetration audit; enabling it
now (`require-trusted-types-for 'script'`) would break any third-party or
generated code that assigns to `innerHTML`. No inventory of such sinks exists
yet — audit first, enable second.

## Verification checklist (Phase 1.5)
- [ ] After deploy: request any page → response includes `Content-Security-Policy-Report-Only`
      with `report-uri /api/public/csp-report`, and `Report-To` JSON header.
- [ ] Trigger a violation (e.g. inject `<img src="https://evil.example/1.png">` in DevTools
      console) → verify a POST to `/api/public/csp-report` is fired, and server-function
      logs contain a `[csp-report]` entry.
- [ ] Navigate the app for a full session (auth → catalog → dispenses → campaigns → analytics);
      DevTools Console should show zero `Refused to …` messages related to legitimate assets.
      Any that appear → widen `THIRD_PARTY_HOSTS`, redeploy, re-verify.

## Regression risk
- **Zero enforced behavior change.** CSP remains Report-Only.
- New public route `/api/public/csp-report` accepts POST only; body-capped; no
  side effects beyond `console.warn`. Safe.

## Files changed (Phase 1.5)
- `src/lib/security/headers.server.ts` — tightened directives, added `report-to`/`report-uri`.
- `src/routes/api/public/csp-report.ts` — NEW report sink.
- `docs/engineering/WAVE-C-SECURITY-HARDENING.md` — updated (this file).

## Constitution amendment — adopted
> **No automatic fixes during security audits.**
> During Wave C.5 and any future audit-scoped shipment, the agent must not
> modify code as a side-effect of finding an issue. Deliverables are:
> (a) evidence, (b) severity, (c) affected files, (d) proposed fix,
> (e) regression analysis, (f) verification steps. Fixes ship only after
> explicit `GO` in a follow-up turn.

Add this to `docs/engineering/CONSTITUTION-v10.md` on next constitution revision.

## Next: Wave C.5 — Enterprise Penetration Audit
Report-only shipment covering:
- Web: XSS, CSRF, Clickjacking, CSP bypass, Open Redirect, CORS, Session Fixation, Cookie Security
- API: AuthN/AuthZ, Rate Limiting, Replay, Validation, Payload Limits
- AI: Prompt Injection, Tool Injection, Agent Priv-Esc, Budget Bypass, Approval Queue Bypass, Decision Record Tampering
- Database: RLS, SECURITY DEFINER, Tenant Isolation, RPC Exposure
- Supply Chain: Dependencies, Secrets, Env Vars, Build Artifacts

Await `GO` before starting.
