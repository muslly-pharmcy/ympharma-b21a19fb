# Wave R1.3 — Manual Verdicts & Exceptions

Companion to the auto-generated `WAVE-R1.3-AUTHZ-AUDIT.md`. The static
analyzer classifies from local evidence only; a handful of functions
delegate their auth/tenant checks to a helper in the same file. This file
records the human-reviewed verdict for those cases so future runs can
ignore them.

## Auto-classifier caveats

The analyzer inspects a per-function slice of source and flags:

- `context.supabase` vs `supabaseAdmin` — RLS vs bypass.
- `getActor()` / `loadActor()` / `requireActor(...)` — actor auth.
- `requireOrg(...)` / `actor.organizationId` / `assert*InOrg(...)` /
  `organization_id: ...` — tenant scope.
- `requirePermission(...)` / `requireCapability(...)` / `has_role` /
  `hasRole` / admin string literals — RBAC.

It does **not** follow function calls. A handler whose entire body is
`await helper(data)` will appear unauthenticated even when `helper()` does
the check.

## Reviewed exceptions

| File | Function | Verdict | Notes |
|---|---|---|---|
| `src/lib/ai.functions.ts` | `listAgents` | ✅ Safe by design (global catalog) | `air_agents` is a system-wide registry of AI agent definitions — not tenant data. Handler calls `getActor()` (any authenticated user can list) and returns only non-sensitive metadata columns (`key, display_name, description, model, allowed_tools, is_active`). No org filter needed. |
| `src/lib/purchasing.functions.ts` | `submitPurchaseOrder` | ✅ Safe by design (delegated auth) | Handler is a one-liner: `transitionPO(data, ['draft'], 'submitted', 'PurchaseOrderSubmitted')`. `transitionPO` (same file) loads `getActor`, calls `requirePermission(actor, 'purchase.write')`, and asserts `existing.organization_id === actor.organizationId` before mutating. |
| `src/lib/purchasing.functions.ts` | `cancelPurchaseOrder` | ✅ Safe by design (delegated auth) | Same shape as `submitPurchaseOrder` — the enforcement lives in `transitionPO`. |
| `src/lib/cosmic-search.functions.ts` | `cosmicSearch` | ✅ Public by design (R1.2) | Already documented in `WAVE-R1.2-PUBLIC-FUNCTION-REVIEW.md`. Reads only public-catalog columns; the system prompt forbids fabricated pricing/stock. Follow-up: wire `public-endpoint-guard` before marketing traffic. |

## Post-manual-review counts (v R1.3)

Adjusting the auto counts for the 3 exceptions above:

| Verdict | Auto | Manual | Post-review |
|---|---:|---:|---:|
| ✅ RLS-only | 19 | +0 | 19 |
| ✅ RLS + role check | 4 | +0 | 4 |
| ⚠️ Admin bypass (org/role gated — review) | 90 | +0 | 90 |
| ❌ Tenant-leak risk | 1 | −1 (listAgents → global catalog) | **0** |
| ⚠️ Public — unclassified | 3 | −3 (all resolved: 2 delegated auth, 1 R1.2 public) | **0** |
| ✅ Public by design (anon publishable) | 3 | +0 | 3 |
| ✅ Authed, no direct DB access | 34 | +0 | 34 |
| ✅ Safe by design (delegated / global) | 0 | +4 | 4 |

**Zero tenant-leak-risk functions remain.** Zero unclassified public
surfaces remain.

## Follow-ups (non-blocking, tracked)

1. **Wave R1.3.1 — Deep review of the 90 `Admin bypass (gated)` functions.**
   Every one currently pairs `supabaseAdmin` with an explicit
   tenant/permission check, but each pattern deserves individual sign-off
   (e.g. confirm `requirePermission` maps to the correct RBAC scope,
   confirm the ownership assertion happens *before* the mutation, not
   after). Suggested sequencing: batch by domain (customers → dispenses →
   inventory → prescriptions → …), one PR per batch.
2. **Wave R1.4 — Contract audit.** Zod validators exist on ~95 % of
   mutations already; audit the remainder plus error taxonomy, correlation
   IDs, idempotency keys, pagination, and default timeouts.
3. Consider migrating the `admin-bypass` mutation family to a
   `requireSupabaseAuth` + `context.supabase` path where RLS policies
   already exist — RLS is defence-in-depth; the current pattern relies on
   correct code every time.
