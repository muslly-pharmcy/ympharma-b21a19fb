# Public pharmacy security follow-up — 2026-11-16

Based on PR #73 commit 2231153980d624b423c7446b2b03e411766b3b93.

## Changes and verified scope

- Replace whole-row JSON in pn_get_pharmacy_public with explicit pharmacy and opening-hour fields. Preserve public+verified visibility, product_count semantics and existing EXECUTE privileges.
- Preserve both observed ACL contracts: repository migration denies anon; production catalog inspection currently allows anon. The synthetic test exercises both without contacting production.
- Reject recovery.sh outside GitHub-hosted CI, unless the connection is explicitly postgres at 127.0.0.1:5432 with the synthetic database name and no host-address/service/options overrides. This addresses the Graphify advisory on PR #73. These are accident-prevention gates, not an authorization boundary against a malicious operator controlling the environment.
- Add executable SQL behavior checks using isolated PGlite 0.5.16 and 11 unsafe-connection rejection cases, with a dedicated CI workflow.

## Local evidence

- PGlite SQL profile checks: PASS, including future-column non-disclosure, hidden/private profiles, unknown slugs, hostile slug text, explicit opening-hour fields, ACL preservation, and repeated patch application.
- Recovery target rejection checks: 11/11 PASS. No database commands executed by these negative tests.
- Existing legacy inventory and ERP2 tenant-isolation SQL acceptance scripts: PASS in separate in-memory PGlite databases. Not a PostgreSQL server concurrency or pg_dump/pg_restore test.
- Base PR #73 full Vitest run: 537 passed, 8 skipped, 71 passed files and 1 skipped file. Does not prove device, production or load acceptance.

## Deployment blockers and rollback

This is a proposal, not a production migration. Direct table permissions and policies need separate review; narrowing one RPC does not prove all administrative data paths are closed. External consumers of omitted administrative/hour ID fields have not been accepted. Product-count approval filtering is unchanged and requires its own contract review.

Before deployment: review current function definition/ACL/schema drift, identify all callers, obtain documented acceptance and a verified restorable backup, then test the real Supabase schema on an approved isolated environment. Keep the pre-change function definition and ACL in the approved deployment evidence. Roll back only this function definition if necessary; do not blindly reverse historical grants or grant anon. An automatic rollback migration is intentionally absent because live ACL differs from repository history.

No production data, patient records or credentials were copied. No ISS financial adjustments, catalog import, production migration, merge or deployment performed.
