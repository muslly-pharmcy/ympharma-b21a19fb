---
name: pharma-device-load-certification
description: Certify 12-hour offline POS, Android/Windows releases and measured 100k-monthly transaction capacity for 30 branches and 150 cashiers.
---

# Offline, devices and performance

- An offline cart queue or PWA shell is not an offline financial POS. Require server-issued, expiring per-device per-lot quotas and cryptographically bound identity.
- Keep each offline sale in encrypted local transactional storage, with immutable UUID command journal and server-side replay/idempotency.
- Test 12-hour offline operation, clock manipulation, two devices, app kill, restart, forced logout, server rejection, duplicate acknowledgments and reconciliation.
- Generate deterministic synthetic invoices/journals with the existing `scripts/load/ympharma-synthetic-fixtures.mjs`; generation does not prove TPS or p95 latency.
- Load test only an isolated staged clone with 30 branches and 150 cashiers. Record p50/p95/p99, database locking, worker CPU, RLS, conflicts, negative stock and ledger balances.
- Android Debug APK is not a release. Require signed APK/AAB, protected signing key, barcode camera, scanner/thermal printing and real-device RTL testing.
- Windows browser/PWA is not a native installer. Test keyboard Tab speed, barcode readers, printing, reconnect and controlled install/updates before choosing MSIX or Tauri.
- A production go-live requires exact build hash, rollback plan and evidence for all transaction invariants; never infer success from browser smoke alone.
