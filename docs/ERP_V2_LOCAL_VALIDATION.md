# Historical local validation of protocol2 patch

This is retained October8 evidence, not the current acceptance result. The October15 full-schema tests, native durable worker checks, complete Node build and remaining gates are described in [ERP_INTEGRATION_CONTRACT.md](./ERP_INTEGRATION_CONTRACT.md). The current bridge supersedes the in-memory-only implementation described below. Production remains unactivated.

Base SHA: dc820fa10a61a9f9d974c38a4d98e49de1efbf74. No push, deployment, new operational key or remote database access.

-17 targeted protocol/guard/cursor/reservation-reference tests passed.
-10 isolated PostgreSQL cases passed using0005 plus the new migration: durable partial outcomes, exact replay, row conflicts, decimal/UOM validation, concurrency, rollback, expired request and permissions.
-Real loopback HTTP through the original handler and stock executor into the isolated DB: response socket lost after commit, two retries, exact saved outcome and one row application.
-Independent ERP WebCrypto formatter matches shared public vectors; original ERP build and405tests passed. Original189financial tables unchanged.
-Core protocol helpers type-check; the whole website build is **not accepted**: baseline package-lock/package.json mismatch, and bounded unlocked dependency installation did not complete. Neither file was modified.
-Reservation tests exercise an in-memory reference only. Orders remain hard-disabled503; snapshot staging does not implement live checkout, expiry or release.

Evidence/work scripts: C:/Users/ALBASHA/Documents/Codex/2026-10-03/task/phase71. Sealed delivery: C:/Users/ALBASHA/Documents/Codex/2026-09-26/https-chatgpt-com-share-6ab74c9b-55e0/work/erp/docs/completion/evidence/muslly-site-v2. The source migration was only applied to a fresh isolated database named in phase71/db-name.json. No original ERP migration was added. No account/role/credential was created. Full site migration history/runner and build remain review gates.


## Build acceptance update — 2026-10-08
Earlier dependency/build blocker is superseded: corrected npm lock only, unchanged package.json; clean offline npm ci with lifecycle scripts disabled passed, full production build and TypeScript passed, 20 focused site tests passed. Synthetic environment only, no deployment. See original ERP CHECKPOINT-20261008-BUILD-BRAND.md for evidence and remaining live-integration gates.
