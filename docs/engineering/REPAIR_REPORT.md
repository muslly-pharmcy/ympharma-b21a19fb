# Repair Report — 2026-08-14

Scope: the verified audit/repair wave approved in
`.lovable/plan/ympharma-os-verified-audit-baseline-and-repair-plan-2026-08-14.md`.
Every claim below is marked VERIFIED, PARTIALLY VERIFIED, or NOT VERIFIED.

## A. Executive summary

Five evidence-backed defects were repaired: a failing clinical-provider
contract, a completely non-functional lint pipeline, a PostgREST filter
injection in the pharmacist patient search, duplicated WhatsApp webhook
security code, and the absence of any CI gate. No feature was removed, no
dependency swapped, no architecture changed.

## B. Baseline findings (before changes)

| Check | Result |
|---|---|
| `bunx tsgo --noEmit` | Clean |
| `bunx vitest run` | 195 pass / **1 fail** (`tests/clinical-engine.test.ts`) |
| `bunx eslint .` | **Could not run** — no `eslint.config.js` (ESLint 9 flat config missing) |
| `.github/workflows/` | Only `osv-scanner.yml`; no lint/typecheck/test job |

Stale documentation: `RELEASE-GATE.md` listed F-06 and F-07 as open. Both were
already implemented; the doc, not the code, was wrong.

## C. Files modified

| Path | Reason | Change | Risk |
|---|---|---|---|
| `src/lib/clinical/registry.server.ts` | Unknown provider id silently fell back to the `local-db` clinical dataset | Unknown id now returns the null provider; unset still uses the curated local KB | Low — narrows a silent substitution |
| `tests/clinical-engine.test.ts` | Encoded the unset-provider default incorrectly | Asserts null provider for unknown id, `local-db` for unset | Low |
| `src/lib/security/postgrest-filter.ts` (new) | Shared, testable filter-term sanitiser | `sanitizeFilterTerm` / `ilikeContains` | None (pure) |
| `src/lib/medication-vault-admin.functions.ts` | Raw term interpolated into a PostgREST `or()` expression | Sanitises the term before building the filter | Low — search behaviour preserved for normal terms |
| `src/lib/whatsapp/webhook.server.ts` (new) | Two webhook routes carried duplicate HMAC/handshake code | Single shared handler (verify, handshake, parse, persist, rate limit) | Low |
| `src/routes/api/public/hooks/whatsapp.ts` | Deduplicate | Delegates to the shared module | Low |
| `src/routes/api/whatsapp-webhook.ts` | Deduplicate; legacy URL preserved | Delegates to the shared module | Low |
| `src/stores/shopify-cart.ts` | Ternary used as a statement | Converted to `if/else` | None |
| `eslint.config.js` (new) | `npm run lint` was dead | ESLint 9 flat config, TS + react-hooks | Low |
| `.github/workflows/ci.yml` (new) | No CI gate | typecheck + lint + tests on PR and `main` | None |
| `tests/postgrest-filter.test.ts` (new) | Injection regression coverage | 5 tests | None |
| `tests/whatsapp-webhook.test.ts` (new) | HMAC/handshake/parsing coverage | 5 tests | None |
| `docs/engineering/RELEASE-GATE.md` | Stale statuses | Re-baselined with evidence | None |

## D. Database changes

None. No migration was created or modified in this wave.

## E. Security changes

1. **PostgREST filter injection (VERIFIED fixed).** `searchPatientRoster`
   previously built `full_name.ilike.%<q>%,phone.ilike.%<q>%` from the raw
   term; a term containing `,` or `)` could rewrite the expression against
   `hc_patients` via the service-role client. Terms are now stripped of
   `, ( ) . " ' \ : * %` and control characters, length-capped, and covered by
   regression tests.
2. **WhatsApp webhook contract unified (VERIFIED).** One implementation of
   HMAC-SHA256 verification (over raw bytes), constant-time verify-token
   comparison, per-IP rate limiting, and idempotent `message_id` upserts, used
   by both routes — they can no longer drift.
3. **RLS / storage re-verified (VERIFIED by direct query, unchanged):**
   - `medical_vault_files` — `own_vault` via `patient_belongs_to_current_user`,
     plus an explicit `vault_staff_read` gated on `has_role(admin|owner)`.
   - `patient_chronic_medications` — `pcm_owner_all` on `auth.uid() = user_id`,
     staff read explicitly role-gated.
   - `family_health_profiles`, `family_health_accounts`, `hc_patients` —
     owner/organization-scoped; no `true` policies.
   - `medical-vault` storage bucket: `public = false`.
4. **Database linter (PARTIALLY VERIFIED).** 499 findings, dominated by the
   previously reviewed aggregate `anon_security_definer_function_executable`
   and `extension_in_public` classes. No new class introduced by this wave;
   individual triage remains open work.

## F. Clinical safety changes

`getProvider('<unknown>')` no longer substitutes the curated local knowledge
base for a provider that was explicitly requested and does not exist. It
returns the null provider, which emits zero warnings, so a misconfiguration
cannot masquerade as a clinical check performed against a different dataset.
Unset configuration keeps the curated local provider — the previous, intended
default. No clinical rule content was added, removed, or invented.

## G. Tests executed

```
bunx tsgo --noEmit      → 0 errors                       (VERIFIED)
bunx eslint .           → exit 0, 0 errors, ~92 warnings (VERIFIED)
bunx vitest run         → 206 passed / 206, 24 files     (VERIFIED)
bunx playwright test    → NOT RUN (no browser/E2E environment here)
```

## H. Remaining issues

- **E2E suite NOT VERIFIED** in this environment.
- **F-01** (env resolution on `/` in the published bundle) still needs a
  publish + smoke check; it cannot be closed from the preview environment.
- **Database linter triage** of the SECURITY DEFINER / extension classes is
  still outstanding as a separate wave.
- **Not audited in this wave** (explicitly deferred, per the approved plan):
  full order-lifecycle race-condition review, 7-breakpoint mobile sweep,
  bundle/performance measurement, and the E2E workflow chain.
- ~92 lint warnings remain, deliberately classified rather than suppressed
  (mostly `no-explicit-any`, unused imports, and known-safe control-character
  regexes in sanitisers).

## I. Production readiness

**READY WITH CONDITIONS**

Conditions: (1) publish and smoke-verify F-01; (2) run the E2E suite in an
environment that supports it; (3) complete database-linter triage. The
verified gates — typecheck, lint, and 206 unit/integration tests — are green,
and no RLS bypass, IDOR, privilege escalation, or secret exposure was
introduced by this wave.
