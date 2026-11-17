---
name: muslly-commerce-guard
description: Review medicine storefront catalog, carts, checkout, synchronization and regulatory gates before release.
---

# muslly.com storefront integration guard

## Scope
Use with the actual store source: confirm deployment repo and Supabase project identity before changing any code.

## Checks
1. Approved/public catalog, prescription-required products, media access, batch availability, cost/price source, unit conversions and correct currency precision.
2. One authoritative ERP-to-store sync contract; authenticated/HMAC API; versioned snapshots, organization-scoped idempotency and `ERP_SYNC_ENABLED` kill switch. Avoid legacy stock overwrite paths.
3. Server-authoritative quote, atomic cart confirmation, stock reservation locking order, 99-unit cart cap (if configured), duplicate webhook delivery, cancel and return behavior.
4. SSR public config contains *only* project URL and public key, no server token; no private account data persisted to public caches; safe auth logout race handling.
5. Smoke tests: PDP/404, catalog visibility, cart add/remove, checkout double submit, out-of-stock, expired lot, prescription gate, identity switch and offline reconnect.
6. Test against staging. Provide request IDs and redacted logs; no production order submission or inventory write without explicit scoped approval.

References: https://github.com/cloudflare/security-audit-skill ; https://github.com/addyosmani/agent-skills ; https://github.com/anthropics/skills.
