# Isolated SQL validation checkpoint

Base: 35e2b8295dfaf79763d8f490b387ca0bc0a3044f. Production untouched.

Executed on Windows with embedded-postgres 17.10.0-beta.17 using existing local tooling:
- Existing SQL acceptance script passed against a new synthetic PostgreSQL cluster.
- 20 concurrent decrements: exactly one succeeded, 19 rejected with constraint violation; target stock=reserved=8 and two target movements.
- Recovery did NOT pass: local pg_dump/pg_restore binaries are absent (ENOENT). Runner exits nonzero; no full PASS claim.
- Added CI recovery step: dump disposable fixture, restore into a separate database, compare stock/movements/events/ACL, verify reservation guard and unchanged data after rejection. CI execution pending.

Local runner: set PG_TEST_TOOLING_ROOT to a package directory containing embedded-postgres; PG_TEST_BIN to PostgreSQL client binaries; run node scripts/sql/verify-isolated-recovery.mjs. The runner creates its own loopback-only cluster, preserves temporary evidence and stops it in finally. It never accepts an external database URL.

This checkpoint does not implement offline sales, device quotas, accounting changes, Windows installer or Android acceptance. Synthetic restoration is not full-schema or production recovery proof.

Linear search was attempted but connector returned unavailable; no Linear issue was created or updated.
