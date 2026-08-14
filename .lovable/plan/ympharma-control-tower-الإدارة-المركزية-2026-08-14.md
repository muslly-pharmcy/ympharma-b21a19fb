# YmPharma Control Tower — الإدارة المركزية

Verified state before planning (read this turn):

- The uploaded package is a snapshot of this same repo plus exactly 4 new files: `src/hooks/useSystemSettings.ts`, `src/routes/_authenticated/feature-toggles.tsx`, `src/routes/_authenticated/delivery-config.tsx`, `supabase/migrations/20260814144100_admin_core.sql`. Nothing else differs.
- The package's two pages import **Ant Design** (`antd`), which is **not installed** here. The project has no shadcn `components/ui` folder either — it uses custom glass components under `src/components/*` and `src/shared/components/*` with Tailwind.
- `public.system_settings` and `public.system_audit_logs` **do not exist**. `public.is_control_tower_admin()` **does not exist**.
- `public.app_settings` **does exist** with the exact intended shape (`key, value jsonb, description, updated_by, updated_at`), holding 16 live operational keys, and is already protected by `has_role(auth.uid(),'admin')` write / admin-or-owner read policies.
- None of the eight requested setting keys exist yet, and no code in `src` reads any of them — there are currently zero feature-flag consumers and no delivery-fee logic anywhere.

## Decisions this drives

1. **Reuse `app_settings`.** Creating `system_settings` would be an exact duplicate of an existing, already-secured table. The Control Tower keys get seeded into `app_settings`.
2. **Reuse `has_role`.** No new `is_control_tower_admin()` wrapper; authorization stays on the existing `user_roles` + `has_role(admin|owner)` model.
3. **Reject the package's `USING (true)` public-read policy.** Current admin-only read stays. Two keys need public exposure (`pharmacy_status`, `custom_announcement`) — those are served by a dedicated public read path, not by opening the whole table.
4. **Drop Ant Design.** The two pages are rewritten with the project's own glass/Tailwind primitives + `sonner` toasts. No new dependency.

## What gets built

### Database (one migration)
- Seed the 8 keys into `app_settings` with `ON CONFLICT DO NOTHING`: `enable_medication_vault`, `enable_ai_marketing`, `enable_delivery_orders`, `enable_clinical_inspector`, `maintenance_mode`, `pharmacy_status`, `custom_announcement`, `delivery_fees_matrix` (Aden keys unchanged: crater, mualla, khormaksar, mansoura, sheikh_othman, dar_saad, buraiqeh).
- New `public.control_tower_audit_log` (admin_id, action, target_key, old_value, new_value, created_at) with GRANTs, RLS, admin-only SELECT, **no UPDATE/DELETE policy** (append-only from the app), and an `AFTER UPDATE` trigger on `app_settings` writing the entry. `SECURITY DEFINER` + `SET search_path = public`, EXECUTE revoked from public/anon/authenticated.
- A narrow `SECURITY DEFINER` function returning only `pharmacy_status` + `custom_announcement` for public reads; nothing else becomes anon-readable.
- Add `app_settings` to the `supabase_realtime` publication.

### Code
- `src/hooks/useSystemSettings.ts` — React Query over `app_settings` via the existing `@/integrations/supabase/client`, typed (no `any`), single named realtime channel with proper cleanup, cache patch on event, optimistic-free update with invalidation on error.
- `src/routes/_authenticated/control-tower.tsx` — dashboard with cards linking only to modules that exist (feature toggles, delivery config, audit log, system settings summary). No invented metrics.
- `src/routes/_authenticated/feature-toggles.tsx` — تحكم الميزات المركزية, five switches, RTL.
- `src/routes/_authenticated/delivery-config.tsx` — إدارة أسعار التوصيل — عدن, Arabic labels over English keys, Zod validation (integer, finite, >= 0; rejects negative/decimal/NaN/Infinity), dirty-state guard, save + toast.
- `src/routes/_authenticated/control-tower.audit.tsx` — read-only audit log table.
- Admin entry point added to the existing navigation, visible only to admin/owner. No second sidebar or layout.

### Feature flags — real wiring
Flags will be wired where a safe existing consumer exists:
- `enable_medication_vault` → hides the vault/prescription upload surfaces in patient profile.
- `enable_delivery_orders` → gates the delivery/checkout delivery option.
- `enable_clinical_inspector` → gates the clinical inspector admin surface.
- `enable_ai_marketing` → gates the marketing/social-assistant surfaces.
- `maintenance_mode` → patient-facing maintenance notice; admin/owner keep full access (checked against `has_role`, so no lock-out).

Anything without a safe consumer — expected: `delivery_fees_matrix`, since no checkout fee calculation exists today — is reported as `STORED BUT NOT YET CONSUMED` rather than faked.

### Verification
`tsgo --noEmit`, `eslint .`, `vitest run` (baseline 206), and a production build. New tests: authorization matrix (anon/patient/staff/admin), settings read+update+validation, delivery fee validation cases, audit-record creation. Playwright and the published-bundle secret scan are attempted; if the environment blocks them they are reported as `BLOCKED BY ENVIRONMENT`, not asserted.

## Deviations from the uploaded package

| Package | This plan | Reason |
|---|---|---|
| new `system_settings` table | reuse `app_settings` | identical schema already exists and is in use |
| `is_control_tower_admin()` | existing `has_role(admin\|owner)` | no duplicate auth path |
| `USING (true)` public read | admin-only + narrow public function | admin config must not be world-readable |
| Ant Design UI | project Tailwind/glass + sonner | antd is not a dependency here |
| migration without GRANTs | GRANTs included | required or PostgREST 401s |
