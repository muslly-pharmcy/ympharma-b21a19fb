# Verified internal RPC remediation — 2026-11-12

Scope: linked Supabase project `ybhrmcdlgyccywpmiucz`. No other projects were changed.

## Evidence

Three SECURITY DEFINER functions exposed to `authenticated` lacked direct caller membership verification:

1. `public.create_scheduled_backup(text)` — writes backup payload including orders and prescriptions, deletes older backups; existing PostgreSQL jobs `backup-daily` and `backup-weekly` run as `postgres`.
2. `public.inv_intel_snapshot()` — processes global inventory intelligence; scheduled PostgreSQL job `inventory-intelligence-snapshot` runs as `postgres`.
3. `public.inv_emit_event(text,uuid,text,uuid,jsonb)` — accepts supplied organization IDs and creates `agent_events`; no direct frontend caller found in the main branch.

## Remediation

- Applied live SQL migration **20261111215832** (mirrored in this branch), revoking `PUBLIC`, `anon`, and `authenticated` EXECUTE on these three functions, retaining `service_role` and owner privileges.
- Read-only post-check found all three inaccessible to both client roles, and accessible to `service_role`.
- Supabase Security Advisor count of signed-in callable SECURITY DEFINER functions decreased from **176 to 173**. Six anonymous callable functions remain, mostly public catalog/discovery features; they need output/filter and RLS review, not unconditional removal.

## Cautions

- A PostgreSQL `has_table_privilege` result is a **table ACL**, not an effective RLS result; validate member/non-member access in a two-tenant staged test.
- A grep-based check that a function lacks `auth.uid()` is not sufficient to prove privilege escalation: inspect transitive authorization and SQL owners.
- This operation did **not** run business mutations or end-to-end checks; verify cron, inventory event consumer, and cashier workflows on a staging environment.
- Do not hide or suppress remaining advisor findings without evidence.
