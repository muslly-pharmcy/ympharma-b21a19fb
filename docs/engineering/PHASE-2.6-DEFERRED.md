# Phase 2.6 — Edge Protection (Deferred)

The following controls are **not** implemented in Phase 2.5 and are consciously
deferred to a dedicated Edge Protection phase. Do not treat their absence as an
audit finding until Phase 2.6 is scoped and executed.

## Deferred controls

| Control | Reason for deferral | Recommended layer |
|---|---|---|
| CSRF middleware | We authenticate via `Authorization: Bearer <jwt>` attached by client middleware. No session cookies participate in auth. CSRF only matters for cookie-authenticated flows. | Revisit if we ever add cookie-based sessions. |
| Rate limiting | Requires a shared store (Redis / Cloudflare KV / Durable Object) and a policy engine. Hand-rolled per-fn counters in the app process leak in serverless and cannot enforce a global budget. | Cloudflare Rate Limiting Rules or an upstream WAF, keyed by IP + user. |
| Replay protection | The existing `inventory_idempotency` table + `idempotencyKey` header already prevent replay for state-changing mutations. A generic nonce store for all requests is scope creep. | Extend `withIdempotency` coverage to any new mutation surface, or add a request-nonce middleware in Phase 2.6. |
| Session expiration policy | Supabase Auth issues short-lived access tokens (1h default) and rotates refresh tokens automatically. Custom expiration logic on top duplicates this and is a common source of "randomly signed out" bugs. | Configure `jwt_expiry` and refresh-token settings in Supabase Auth settings if needed. |
| Secure-cookie handling | We do not set app cookies for auth. Bearer token lives in memory (Supabase JS client) + `localStorage`. | Only relevant if we introduce SSR cookie sessions. |

## What Phase 2.5 does ship

- Real Supabase Auth (email/password) with bearer-token attachment.
- Server-side session resolution (`getActor`) that validates JWTs and hydrates
  organization membership + roles on every mutation.
- Full audit trail with actor / org / branch / IP / UA / correlation ID.
- Idempotency keys enforced via `public.inventory_idempotency`.
- RLS-enforced org isolation on every table touched by the mutation set.

Rate limiting and CSRF are Phase 2.6. This document is the record.

## Phase 2.5 delivered

- Real Supabase-backed `getActor()` with JWT validation + org membership hydration
- `_authenticated/` route gate (ssr:false, redirect to /auth)
- `/auth` sign-in/sign-up/forgot-password + `/reset-password` pages
- Root `onAuthStateChange` subscriber → router.invalidate() + query invalidate (SIGNED_IN/OUT/USER_UPDATED only)
- Navbar signed-in/signed-out affordances + 4-step sign-out hygiene
- `attachSupabaseAuth` bearer middleware wired in `src/start.ts`
- `audit_events` table + `audit()` helper called after every mutation
- RBAC permission matrix (`requirePermission`) enforced on 18 mutation server fns
- Supabase auth: signup enabled, anonymous disabled, auto-confirm off, HIBP on

## Still deferred to Phase 2.6

- Rate limiting, CSRF (N/A with bearer), replay protection at edge, secure-headers middleware
- E2E test with real signed-in session (recommend: dedicated test project)
- Google OAuth (Supabase provider config + `lovable.auth.signInWithOAuth`)
- Multi-org / branch switcher UI (session picks first active membership)
- Session revocation UI (Supabase manages TTL + refresh)
