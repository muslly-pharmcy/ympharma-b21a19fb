# Phone OTP verification, patient-identity safety, and test coverage

## What I found (verified now, no assumptions)

- Phone sign-in code already exists in the sign-up/sign-in screen and calls the standard Cloud auth OTP send/verify. It is gated behind the `enable_phone_auth` flag, which is currently **false**.
- There is **no Twilio code, secret, or reference anywhere in the project**. Two Twilio connections exist in your workspace but **neither is linked to this project**.
- Even when linked, a Twilio connector only gives the app server API access — it does **not** make phone OTP work. Cloud Auth sends OTP itself and needs its SMS provider configured in the backend auth settings (provider + Account SID + Auth Token + Messaging/Verify service). That setting is not reachable from code.
- Patient identity resolution is correct in code (resolved by user id only, never by name), **but the patients table has no unique constraint on the user column** — only a plain index. Two concurrent requests can create two patient rows for one user.
- Access rules for patient data are patient-scoped and look sound (own rows by user id, plus staff access through organization permissions). One gap: the self-write rule lets a patient write their own row with any organization value.
- `test:e2e` / `playwright test` scripts exist and Playwright is installed, but there is **no Playwright config and no e2e test folder** — so e2e currently cannot run at all.

## Plan

### 1. Guarantee one patient per user (database)
- Add a unique constraint on the patients table user column (after checking for and merging any existing duplicates).
- Tighten the patient self-write rule so a patient cannot attach their own record to an organization they don't belong to.
- No change to staff/organization access rules.

### 2. Unit tests (vitest)
New tests covering the registration path that already works (email):
- Three-part Arabic name validation and normalization: valid, missing part, single-letter, Latin/mixed input, extra whitespace, name-only rejection.
- Phone normalization to international format: Yemen local, with country code, invalid input.
- Arabic error mapping for the auth failures the flow can hit (wrong credentials, unconfirmed email, weak password, phone disabled).
- Patient identity rules: identity resolves by user id, never by name; existing verified data is not overwritten.

### 3. E2E tests (Playwright)
- Add a Playwright config pointed at the local dev server, plus a first spec for the email journey: name step → method step → email sign-up → error states → and a phone-step assertion that the phone option shows the "not available yet" message while the flag is off.
- The e2e spec runs against the preview app; it will not fabricate OTP codes.

### 4. Email flow status test run
Run the full email journey (account creation, verification state, patient record creation, dashboard redirect) and report **READY** or exactly which setting is missing (e.g. email confirmation behaviour).

### 5. Phone OTP — what I can and cannot do
I can enable the flag and run a real OTP test **only after** the backend SMS provider is configured. Because that lives in backend auth settings, this part is reported as:

**CONFIGURATION REQUIRED** — needed from you:
1. In the backend auth settings, enable the Phone provider and select Twilio (or Twilio Verify).
2. Provide the Twilio Account SID, Auth Token, and Messaging Service SID / Verify Service SID there.
3. Confirm your Twilio account can send SMS to Yemen (+967) and give me one authorized test number.
4. Fix the SMS template to use the OTP placeholder `{{ .Code }}`.

Once those exist, I will flip `enable_phone_auth` on from the Control Tower and run the real OTP test end to end (request code, verify the real code, confirm session, confirm exactly one patient record, sign out, sign in again, confirm the same identity is reused). Never a fabricated code.

### 6. Regression
Typecheck, lint, vitest, build, and the new Playwright suite — actual results reported, nothing weakened or removed.

## Technical notes

- Migration: `ALTER TABLE public.hc_patients ADD CONSTRAINT hc_patients_user_id_uniq UNIQUE (user_id)` after a duplicate-merge pass; replace `patients_self_write` with a version whose write check requires `organization_id IS NULL OR is_org_member(auth.uid(), organization_id)`.
- New files: `playwright.config.ts`, `e2e/auth-email.spec.ts`, `tests/auth-patient-name.test.ts`, `tests/auth-phone-normalize.test.ts`, `tests/auth-errors.test.ts`.
- No new auth system, no second Supabase client, no OTP storage, no new patient tables, no secrets in browser code.

## Out of scope
AI Core, Control Tower architecture, and every other module stay untouched.
