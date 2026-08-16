# Wave R1.2 — Public Function Review

Generated companion to `SERVER-FN-AUDIT.md`. Every server function flagged as
unauthenticated in the previous audit has been re-classified as either
**Authenticated by design** (middleware added) or **Public by design** with a
documented justification and the guardrail that keeps it safe.

Reviewer: Principal Engineer, Wave R1.2.
Constitution: **no server function may sit in a grey area** — every endpoint
is either signed in or is a documented public surface.

## Verdicts

| # | Function | File | Verdict | Evidence & Guardrail |
|---|---|---|---|---|
| 1 | `listProducts` | `src/lib/catalog.functions.ts` | ✅ Public by design | Storefront browse used by Cosmic Search and future public catalog. Server now **unconditionally** forces `is_public=true AND status='approved'`; the `publicOnly` input flag is accepted for compat but ignored. Query goes through the anon publishable client, protected by narrow `TO anon` SELECT policy. No pricing/stock/supplier fields exposed in the public catalog columns. |
| 2 | `getProduct` | `src/lib/catalog.functions.ts` | ✅ Public by design | Product detail page. Same gate as `listProducts` enforced server-side (`is_public AND status='approved'`), so unpublished drafts stay hidden even when a UUID leaks. Barcodes/media rows are subject to the same public RLS. |
| 3 | `listCategories` | `src/lib/catalog.functions.ts` | ✅ Public by design | Returns only global (`organization_id IS NULL`) active taxonomy for the public storefront. No org-specific or private data. Read via anon publishable client. |
| 4 | `cosmicSearch` | `src/lib/cosmic-search.functions.ts` | ✅ Public by design (rate-limit follow-up) | Public AI answer over the public catalog only — inventory context comes from `fetchInventoryContext`, which reads the same `is_public + approved` slice, and the system prompt forbids fabricated pricing/stock and requires clinical hand-off. Uses server-side Lovable AI key (never leaked). **Follow-up (non-blocking):** add IP-hash cooldown via `public-endpoint-guard` before enabling on marketing traffic. |
| 5 | `listPurchaseOrders` | `src/lib/purchasing.functions.ts` | 🔒 Authenticated by design | Internal operational document. Only caller is `/_authenticated/purchase-orders.tsx`. **Fix applied:** now uses `requireSupabaseAuth` + `context.supabase`; dropped the anon publishable client path so RLS evaluates against the real membership rather than silently returning `[]`. |
| 6 | `listSuppliers` | `src/lib/suppliers.functions.ts` | 🔒 Authenticated by design | Internal, org-scoped supplier list. Only caller is `/_authenticated/suppliers.tsx`. **Fix applied:** `requireSupabaseAuth` middleware + `context.supabase`. |

## Post-review state

- Total server functions: **154**.
- Authenticated by design: **150 / 154** (was 148).
- Public by design (documented): **4 / 154** — `listProducts`, `getProduct`, `listCategories`, `cosmicSearch`.
- Grey area: **0**.

## Follow-ups (tracked, not release blockers)

1. Wire `public-endpoint-guard` (body cap + IP-hash cooldown) around
   `cosmicSearch` before it is linked from unauthenticated marketing pages —
   the model call has a real cost per invocation.
2. Re-run `node scripts/audit-server-fns.mjs` after any new
   `.functions.ts` file to keep the inventory fresh.
