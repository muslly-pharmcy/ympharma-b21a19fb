---
name: pharma-supabase-rls
description: Inspect Supabase PostgreSQL tenancy, least privilege and Row Level Security.
---

# Supabase RLS

- Confirm actual Supabase project ID, schema, grants, migrations and policy state before any change.
- Check owner/manager/cashier/anonymous roles and strict org/branch isolation.
- Audit SECURITY DEFINER ownership, search_path, parameter binding and caller context.
- Never expose service_role, DB passwords or HMAC secrets in client bundles, VITE_* or public build outputs.
- Plan transaction-safe reversible migrations with backup and explicit review.
- Draft SQL and negative-case tests; never execute production migrations without scoped approval.
- Keep VOLTA field_sales separate from YmPharma and Oracle data.
