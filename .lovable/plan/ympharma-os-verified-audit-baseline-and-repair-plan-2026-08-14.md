# YMPharma OS — Verified Audit Baseline and Repair Plan

I ran a real baseline against the repository rather than trusting the existing audit docs. Below is what is actually true today, then the repair work I propose.

## Verified baseline (evidence-backed)

| Check | Command | Result |
|---|---|---|
| Typecheck | `tsgo --noEmit` | Clean, zero errors |
| Tests | `vitest run` | 195 pass, **1 fail** (`tests/clinical-engine.test.ts` — unknown provider id returns `local-db` instead of the null provider) |
| Lint | `eslint .` | **Broken** — no `eslint.config.js` exists, so `npm run lint` cannot run at all |
| CI | `.github/workflows/` | Only `osv-scanner.yml`; no lint/typecheck/test job |

Stale documentation confirmed: `docs/engineering/RELEASE-GATE.md` still lists F-07 (`inventory.functions.ts` missing auth) and F-06 (`.env.example`) as open. Both are already done — every server fn in `inventory.functions.ts` carries `requireSupabaseAuth`, and `.env.example` is the real contract.

Medication Vault and Clinical Inspector are implemented, not stubs: all vault server functions (`listChronicMedications`, `saveChronicMedication`, `deleteChronicMedication`, `listVaultBoxPhotos`, `createVaultUploadUrl`, `registerVaultBoxPhoto`, `deleteVaultBoxPhoto`) run behind `requireSupabaseAuth`; the inspector gates on `has_role(admin|owner)` server-side before touching the admin client.

## Real defects found

1. **Failing clinical test** — provider registry falls back to `local-db` for an unknown id; the test expects the null provider. One of the two is wrong; the safe clinical behaviour is an explicit null provider (no silent substitution of a data source).
2. **Lint pipeline non-functional** — ESLint 9 flat config missing. Acceptance criteria require lint to pass; right now it errors out.
3. **PostgREST filter injection in patient search** — `searchPatientRoster` interpolates the raw query string into `.or('full_name.ilike.%q%,phone.ilike.%q%')`. A query containing `,` or `)` can rewrite the filter expression against `hc_patients` (read through the service-role client). Needs sanitising/escaping of the term.
4. **Duplicated WhatsApp webhook logic** — `src/routes/api/whatsapp-webhook.ts` (legacy) and `src/routes/api/public/hooks/whatsapp.ts` each carry their own copy of HMAC verification and handshake code. Same contract, two implementations that can drift.
5. **No CI gate** — nothing prevents a red typecheck/test from landing.

## Proposed work (surgical, no rewrites)

### Phase 1 — Make the gates real
- Restore lint: add an ESLint 9 flat config matching the stack (TS, React hooks, import rules) tuned so the existing codebase passes or produces only classified warnings. No rule-disabling sprees.
- Fix the clinical provider registry so an unknown/undefined id returns the null provider, and keep the existing test as the contract.
- Add a CI workflow running install → typecheck → test on PR and `main`, alongside the existing OSV scan.

### Phase 2 — Security repairs
- Escape/sanitise the search term in `searchPatientRoster` before building the PostgREST `or()` filter, plus a regression test asserting a `,`/`)`-bearing term cannot widen the result set.
- Re-run the database linter and review RLS/policies for the medication-vault tables and the `medical-vault` bucket, reporting findings rather than asserting security.

### Phase 3 — Consolidation
- Extract the shared WhatsApp verification (HMAC, verify-token handshake, envelope parsing/persistence) into one server-only module; both routes call it. Legacy path keeps its URL and behaviour.

### Phase 4 — Verified reporting
- Rewrite `docs/engineering/RELEASE-GATE.md` to the actual state (close F-06/F-07 with evidence, keep F-12 tied to the new CI job) and write a `REPAIR_REPORT.md` listing exactly what was changed and what was verified vs. not.

## What I will not do without a separate go-ahead

The prompt asks for a full 16-gate audit including E2E, mobile-viewport sweeps at 7 breakpoints, performance/bundle work, and a full order-lifecycle race-condition review. Those are large and mostly investigative; I'd rather land the verified defects above first, then scope the next wave from measurements. Nothing in this plan removes features, changes the stack, or weakens authorization.

## Technical notes

- ESLint config will be flat-config only (`eslint.config.js`), no `.eslintrc` fallback, typescript-eslint with type-aware rules limited to `src/**` to keep runtime acceptable.
- The search fix escapes PostgREST reserved characters (`, ( ) . :` and `%`) or switches to a parameterised `ilike` pair via two queries — whichever preserves current behaviour exactly.
- WhatsApp consolidation lands in a `*.server.ts` module so neither route pulls admin credentials into a client-reachable graph.
