# G1: legacy inventory adjustment hardening — review and release gate

**Date:** 2026-11-16  
**Scope:** `public.inv_adjust_stock(uuid,numeric,text)` and the `inv_stock_batches` reservation invariant.  
**Linked issue:** #68. **Staging prerequisite:** #70.

## Evidence from live *read-only* inspection

- There are **two overloaded procedures**. The legacy **three-parameter** `inv_adjust_stock` can be executed by `authenticated`. It reads a batch without `FOR UPDATE` and checks only that the new on-hand quantity is not negative; reserved quantity is not checked.
- The newer **five-parameter** `inv_adjust_stock` is callable only by `service_role` and already has batch-level locks and a reservation check. **Its definition and grants are not changed by this patch.**
- The batch table has separate `qty_on_hand >= 0` and `qty_reserved >= 0` constraints; it lacks `qty_reserved <= qty_on_hand`.
- Inspection found 15 batches, none with reserved above on hand or negative quantities. Inventory batch/warehouse organization mismatch count: zero.
- The named Supabase branch reports `MIGRATIONS_FAILED` even though the project itself is `ACTIVE_HEALTHY`. Do not automatically replay all migrations to production.

## Code changes on this branch

1. A new, forward-only SQL migration adds the reservation invariant and hardens **only** the existing three-parameter function without changing its signature or return type.
2. It obtains an authenticated actor, checks `inventory.write` scoped to the batch's organization, rejects a mismatched warehouse, validates finite nonzero delta/reason and locks the batch with `FOR UPDATE`.
3. It updates the locked quantity, writes `inv_stock_movements`, and emits the existing event in the same SQL transaction. It retains the existing `authenticated` permission (and excludes `anon`).
4. A disposable **PostgreSQL 17** GitHub Actions workflow supplies synthetic tables, mock identity/permission helpers and scenarios verifying authorization, reservation bounds, invalid inputs, stock movements, and **two competing decrements**. This is an **integration test of the SQL** rather than a source-only regex.
5. Nothing on this branch has been applied to the connected live database.

## What remains unproven

- Mocked `auth.uid` and permissions in CI are not substitutes for Supabase Auth/RLS end-to-end tests. Run authenticated cross-tenant and branch tests in a non-production Supabase project.
- The older three-argument RPC does **not** carry a client-provided idempotency key. Exactly-once inventory adjustments remain pending a separate idempotent command/RPC transaction.
- Global absolute stock setter and Excel importer are addressed separately by draft PR #67; this migration does not make those paths safe to re-enable.
- Confirm the use of `supabase migration new guard_legacy_inv_adjust_stock` through the current CLI in a real checkout to reconcile the migration filename/version with the migration source of truth **before applying it**. The SQL was authored through the GitHub connector because the Supabase CLI is not available in this session.
- Inspect all inventory write paths for common lock ordering and transaction-level reconciliation; a database CHECK enforces this invariant but may reject existing unsafe write patterns.

## Production gate

- [ ] GitHub CI PostgreSQL test and application CI both pass on this PR.
- [ ] Migration history/branch issue #70 resolved, migration version generated/verified with CLI.
- [ ] Isolated staging test with real tenant/branch users, checkout and reservations.
- [ ] Concurrent test of 500 attempts on one available unit, **exactly one success**, and repeat-key idempotency.
- [ ] Backup/restoration rehearsal and explicit change window; do not publish without the production owner approving the release.

**Rollback policy:** Do not roll back to a callable insecure three-argument function. If the new function causes failures, revoke `authenticated` execution on that signature and repair forward; reconcile any affected orders with movement history. Roll back only after taking/validating a point-in-time backup in an isolated environment.
