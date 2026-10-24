# ADR-0003 — Clinical screening evidence at approval and dispensing

- **Status:** accepted (Sprint 1, domain `clinical-screening`)
- **Date:** 2026-10-24
- **Owners:** pharmacy clinical + platform
- **Related:** `docs/engineering/ADR-0001-event-bus-and-dlq-replay.md`, `docs/engineering/PHASE0-AUDIT-2026-10-24.md`

## Context

The platform already had a clinical engine (`src/lib/clinical/engine.server.ts`) and an
offline interaction matrix (`src/lib/medical/interaction-engine.ts`), but:

- the engine was wired only to cart screening (`cart-safety.functions.ts`) and a manual
  prescription panel; dispensing and prescription approval ran no clinical checks;
- no screening result was persisted, so a pharmacist decision could not be traced to its
  input;
- there was no way to record a deliberate override of a critical finding.

Patient safety therefore depended on a human remembering to press "run check", and the
system could not answer "what evidence did the pharmacist see when this was dispensed?".

## Decision

Introduce a persisted, evidence-first screening record for two flows:

1. `prescription_approval` — after a prescription transitions to `approved`;
2. `dispense` — on dispense verification and again as a gate before stock consumption.

Key rules:

- **Deterministic engine is the source of truth.** The record always contains the provider
  id, confidence, severity, warnings and a hash of the exact screened drug set.
- **AI is narrative only.** `clinical-screening-summary.server.ts` may add a short Arabic
  summary built from severity/category/code (no PII, no new clinical advice). Any failure
  returns the deterministic summary.
- **Critical findings block dispensing unless overridden.** `critical` + no override stops
  `inv_consume_reservation`. A pharmacist with `dispense.verify` records a reason (≥10
  chars, acknowledged) that is stored on the screening row and in `audit_events`.
- **Fail closed on infrastructure errors at the gate.** If the screening table cannot be
  read while the feature flag is on, dispensing stops with an explicit error rather than
  silently skipping the check.
- **Every row is tenant-scoped** (`organization_id`), readable by active members only; writes
  are service-role only because all writes happen inside server functions.

## Data flow

```
dispense detail UI ──useDispenseScreening──▶ getDispenseScreening
        │                                        │
        ├─ run check ──▶ screenDispense ──▶ runDispenseScreening
        │                                        ├─ load hc_dispenses / items / patient
        │                                        ├─ runClinicalCheck (local-db provider)
        │                                        └─ insert hc_clinical_screenings
        ├─ override ───▶ overrideScreening ──▶ update override_* + audit_events
        └─ summary ────▶ summarizeDispenseScreening ──▶ callOpenAi ──▶ fallback on error

verifyDispense ──▶ runDispenseScreening (advisory, never throws)
dispensePrescription ──▶ getBlockingDispenseScreening ──▶ throw unless override recorded
transitionPrescription(approved) ──▶ runPrescriptionScreening (advisory)
```

## RLS

| Table | SELECT | INSERT/UPDATE/DELETE | Tenant predicate |
|---|---|---|---|
| `hc_clinical_screenings` | `authenticated` active org members | `service_role` only (explicit revoke) | `organization_members.organization_id` |

## AI prompt contract

- Instructions: Arabic pharmacist assistant; at most two lines; no diagnosis, dose advice,
  or new clinical claims.
- Input: up to 20 lines of `severity/category/stable_code` — no patient identifiers, no
  free-text notes.
- Output: plain text; persisted as `summary_ar` with `summary_source='ai'` only after a
  successful call.
- Failure: deterministic summary stays, `summary_source='deterministic'`.

## Known limitations

- `hc_patients` has no weight/height, so pediatric dose validation is not active in this
  version (`calculatePediatricDose` exists but is unused).
- The local provider returns `[]` when fewer than two drug names resolve, so
  `confidence='verified'` can still mean "no rule matched".
- The generated Supabase types do not yet include `hc_clinical_screenings` (no CLI/live
  link in this checkout); the table is accessed through one narrowed untyped handle in
  `clinical-screening.server.ts`.
- `getBlockingDispenseScreening` compares the latest screening, not the exact item hash at
  dispense time. Items cannot change after `prepared`, so the window is bounded; a future
  version should compare `input_hash` against the current item set.
- No dedicated hook unit tests (the repo has no jsdom hook-test harness); the gate,
  permissions and fallback are covered by unit/static tests under `tests/`.
