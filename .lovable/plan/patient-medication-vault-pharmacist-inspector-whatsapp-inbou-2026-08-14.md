# Patient Medication Vault + Pharmacist Inspector + WhatsApp Inbound

Aligns the four remaining GitHub items with the schemas that already exist in this workspace, instead of re-creating tables that are already live.

## What already exists (verified)

- `medical_vault_files` table with RLS policy `own_vault` gated by `patient_belongs_to_current_user(patient_id)`.
- Private storage bucket `medical-vault` with `vault_read_own` / `vault_insert_own` / `vault_delete_own` policies on storage objects.
- `family_health_profiles` (per-user profiles, `current_medicines` as a plain text array — no schedule/timing data).
- `hc_patients` with owner/org policies.
- `src/lib/medical/interaction-engine.ts` exposing `screenSafety`, `canonicalIngredient`, severity labels.
- `src/routes/api/public/hooks/whatsapp.ts` — the Meta verification + HMAC-verified inbound webhook already lives here.

## 1. Chronic medications schema (new migration)

`current_medicines: string[]` cannot hold an Arabic schedule preset, so add one table:

- `public.patient_chronic_medications` — `user_id`, optional `profile_id` (family profile), `medicine_name`, `dose`, `schedule_preset` (enum-like check: `قبل الطعام`, `بعد الطعام`, `يومياً`, `عند اللزوم`), `times_per_day`, `start_date`, `notes`, `is_active`, timestamps + update trigger.
- GRANTs to `authenticated` and `service_role` (no `anon`), RLS enabled, owner policy on `auth.uid() = user_id`.
- Additional read-only policy so pharmacy staff (`has_role(auth.uid(),'admin')` / owner) can read rows and vault box photos for clinical review — required by item 3.
- Filed as `supabase/migrations/20260813150000_medication_vault_rls.sql` per your commit.

## 2. Patient profile page — medication vault tab

New route `src/routes/_authenticated/patient-profile.tsx` (protected subtree) with three tabs, RTL:

- **الملف** — reuses the existing family health profile UI.
- **خزينة الأدوية والعلب** — grid of uploaded box photos from `medical-vault`, upload via file picker plus `capture="environment"` camera input, client-side downscale before upload, delete, signed-URL preview. Files land under `<auth.uid()>/boxes/...` so existing storage policies apply unchanged.
- **الأدوية المزمنة** — add/edit/deactivate chronic meds with the four Arabic schedule presets as pill selectors, plus an inline interaction screen of the active list through `screenSafety`.

Server layer: `src/lib/medication-vault.functions.ts` (`requireSupabaseAuth`) for list/save/delete of meds, and for issuing signed upload/read URLs for vault objects.

## 3. Pharmacist clinical inspector

`src/components/admin/PatientMedicationInspector.tsx`: searchable patient roster (name/phone) → side drawer showing chronic medication list, box photo thumbnails (signed URLs), `screenSafety` results with severity badges, and a one-click WhatsApp consult button built on the existing `buildWhatsAppUrl` helper. Backed by staff-only server functions that verify an admin/pharmacist role before reading another user's data. Mounted into the existing admin surface as a tab/section.

## 4. WhatsApp inbound webhook

`src/routes/api/whatsapp-webhook.ts` as requested, implemented as a thin, signature-verified handler that reuses the same HMAC verification and persistence logic as the existing public hook (extracted into a shared server helper so there is one implementation, two URLs — the old Meta endpoint keeps working).

## Verification

Typecheck clean, storefront and admin routes render, upload → vault listing → inspector read-back checked in the preview.
