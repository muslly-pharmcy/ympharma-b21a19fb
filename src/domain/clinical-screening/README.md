# clinical-screening domain

Persisted evidence for clinical decisions made during prescription approval and dispensing.
See `docs/engineering/ADR-0003-clinical-screening.md` for the full decision record.

## Layout

| Concern | Path |
|---|---|
| Pure types, severity/confidence helpers, zod validators | `src/domain/clinical-screening/schemas.ts` |
| Context loading, engine call, persistence, gate/override logic | `src/lib/clinical-screening.server.ts` |
| Optional AI narrative with deterministic fallback | `src/lib/clinical-screening-summary.server.ts` |
| Authenticated RPC boundary | `src/lib/clinical-screening.functions.ts` |
| TanStack Query hooks | `src/hooks/mutations/clinical-screening.ts` |
| UI panel | `src/components/clinical/DispenseScreeningPanel.tsx` |
| Migration | `supabase/migrations/20261024090000_clinical_screening.sql` |
| Guards | `tests/clinical-screening-*.test.ts` |

## Inputs / outputs

- Input: a dispense id or prescription id, resolved server-side into patient context
  (age/sex, allergies, active conditions) and a drug list (name, dose, route).
- Output: `ScreeningSnapshot` — provider, confidence, highest severity, warnings (with
  category/severity/code/source/evidenceUrl), deterministic Arabic summary, input hash,
  timestamps, optional override.

## Failure modes

| Failure | Behaviour |
|---|---|
| Feature flag `enable_clinical_inspector` off | no screening; gate skipped; API returns `501` |
| Engine/provider error | screening row is not written; advisory call sites continue; the gate fails closed only when a critical row cannot be read |
| Duplicate run with the same drug set | unique `(anchor, input_hash)` returns the existing row |
| Override on a non-critical screening | rejected (`no_override_required`) |
| AI summary failure | deterministic summary, `summary_source='deterministic'` |

## Permissions

- `dispense.read` — read screening / request AI summary
- `dispense.verify` — run screening, record critical override
