# YmPharma Enterprise Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a safe production-capable pharmacy ERP to 30 branches and 150 cashiers, initially with one controlled staging and pilot branch.

**Architecture:** Keep the existing TanStack Start/Vite + Supabase `ym` ledger and the HMAC/idempotent `/api/public/erp/v1/*` boundary. Do not duplicate ledgers or import unverified medicine prices. Each subsystem is independently reviewable; production posting, database migrations, DNS and signed releases require their own acceptance gates.

**Tech Stack:** TypeScript, Vitest, Playwright, Bun, Cloudflare Worker Vite plugin, Supabase PostgreSQL, Capacitor, Android Gradle.

**Spec:** User-approved three phases: (1) security and Cloudflare, (2) tested purchase/receive/sale/return/accounting/store sync, (3) offline, capacity, Windows/Android physical device release.

## Global Constraints

- The single source of truth is `muslly-pharmcy/ympharma-b21a19fb`; `dahsamtransport-source/pharmacy-erp` is not automatically the release source.
- Respect `AGENTS.md`; legacy Oracle stock overwrite behavior is frozen. Never enable ERP sync without source-org binding and rollback.
- Separate staging test organization from real pharmacy data. All production reads must be read-only; financial transaction tests require disposable staging.
- Money must be stored/posted as exact decimals; `ym` monetary amounts currently use `NUMERIC(15,4)`. Exchange rates intentionally have higher precision; do not downcast.
- Use immutable posted journals, FEFO lots, per-org/branch grants, server-side idempotency and safe reversal.
- Do not claim offline certification from storefront localStorage or load-test success from JSONL fixture generation.
- No paid service activation, external posting, or live DNS transfer is implied by this plan.

## Review Focus

1. Cross-tenant caller attempts to read/update another organization's stock or ledger -> deny; cover with two-organization role-scoped tests.
2. Concurrent last-unit purchase across 500 clients -> one success, 499 explicit out-of-stock responses, one journal/stock movement.
3. Retry after successful commit but lost HTTP response -> return same idempotent receipt, no duplicate inventory or journal.
4. Offline grant expiry, revoked/lost device or local clock rollback -> reject local financial writes and reconcile server history.
5. Conflicting official reference, buy-cost, and actual selling prices -> preserve independent provenance, block overwrite, require approval.

---

### Task 1: Workers deployment boundary and isolated Preview

**Files:** `wrangler.jsonc`, `tests/cloudflare-build-boundaries.test.ts`, `docs/deployment/YMPHARMA-CLOUDFLARE-CHECKLIST-20261112.md`.

**Interfaces:** Input is current Worker identity and Vite plugin; output is an isolated Preview configuration and testable build target.

- [x] Add `previews: {}` to the existing Worker config, preserving Worker name and secrets.
- [x] Add blocking regression tests for exact Worker target, Preview settings, Workers vs Nitro mode and Wrangler version.
- [ ] Verify real external Cloudflare Workers Builds log for the published commit and `agent-readiness` mismatch; resolve settings without renaming Worker.
- [ ] Run `bun run build:cloudflare` and a hosted Preview for the exact reviewed commit; smoke test SSR, auth, catalog and server functions.
- [ ] Record source SHA, deployment URL, config, no-secret logs and rollback evidence before production promotion.

### Task 2: Database security and finance invariant audit

**Files:** `scripts/sql/ympharma-integrity-readonly.sql`, `scripts/sql/ympharma-security-readonly.sql`, staging pgTAP cases (to create).

- [x] Add read-only integrity report for both actual accounting and stock models.
- [x] Add read-only inspection of RLS, definer RPC grants, financial precision and ERP/store row counts.
- [ ] Review six anonymous-executable `SECURITY DEFINER` functions one-by-one; confirm intended public data projection and `search_path`.
- [ ] Build disposable two-org DB fixtures and negative pgTAP/API tests; no blanket production revocations.
- [ ] Prove purchase -> FEFO receive -> sale -> posted balanced journal -> referenced return and reversal with crash/retry probes.
- [ ] Verify every committed financial operation has exact four-decimal amounts and no cross-org record exposure.

### Task 3: Catalog preflight and authoritative ERP/store integration

**Files:** `scripts/catalog/review-medicine-import.mjs`, `tests/catalog-import-review.test.mjs`, `drizzle/migrations/0005_erp_integration_foundation.sql` (inspect only).

- [x] Add review-only CSV/JSON/XLS(X) normalization, duplicate and clinical metadata reporting; no database imports.
- [ ] Locate/verify original 6,390-item source and provenance; a separate 13,925-record medicine atlas exists but is not an approved ERP source.
- [ ] Approve SKU/barcode/UOM/conversion and per-currency selling, official reference and purchase-cost authorities.
- [ ] Implement org-bound ERP sync schema and independent migration on disposable staging, then prove two-organization isolation and version ordering; do not run legacy unscoped SQL on production.
- [ ] Validate a real staged store order -> ERP reservation/invoice -> FEFO stock -> journal/settlement -> linked return workflow.
- [ ] Deploy a test stock of five only to a named synthetic organization after reconciliation; never use it as a production opening balance.

### Task 4: Offline and load certification

**Files:** `scripts/load/ympharma-synthetic-fixtures.mjs`, `tests/ympharma-synthetic-workload.test.mjs`, forthcoming isolated offline POS implementation.

- [x] Add deterministic, non-production 100k invoice and 100k journal data generator with 30-branch/150-cashier distribution.
- [ ] Implement server-issued, signed per-device quota by lot with durable encrypted local transactional journal, 12-hour expiry and immutable replay IDs.
- [ ] Test 12-hour offline, two devices, expired/revoked grants, app power loss, duplicate ACK and clock drift with audited recovery.
- [ ] Run k6/Artillery staged database API load, not fixture-only generation; record p50/p95/p99, resource limits and failures.
- [ ] Run 500 concurrent final-unit checkouts against real staged RPC and enforce zero negatives/duplicates/unbalanced postings.

### Task 5: Device delivery and graduated release

**Files:** `.github/workflows/ympharma-device-builds.yml`; dedicated signing and real-device QA pipeline to create.

- [x] Add Android Debug and Windows PWA CI jobs for non-release smoke.
- [ ] Store Android keystore in protected CI secret, build reproducible signed APK/AAB with release permissions, checksum and rollback.
- [ ] Validate Windows Edge/Chrome receipt printer, barcode scanner, RTL keyboard Tab flow; choose native packaging only after hardware check.
- [ ] Pilot one branch with real hardware, backup and rollback, then expand only after recorded zero-reconciliation-difference gates.

## Current observed live baseline (2026-11-14)

- `ym.products=0`, `ym.invoices=0`, `ym.journals=0`, `ym.store_product_links=0`; `public.catalog_products=27`, `public.inv_stock_batches=15`.
- Read-only stock checks returned zero invalid quantities in both stores, but the ERP core has no operative transactional dataset, so this is **not** a successful end-to-end checkout certification.
- Six public-schema `SECURITY DEFINER` functions are executable by `anon`; verify the purpose and proof of least privilege before modification.
- Monetary columns in `ym.invoice_lines`, `ym.invoices`, `ym.journal_lines` are `NUMERIC(15,4)` with higher precision for exchange rate; legacy `public` structures differ.
- Existing Cloudflare PR #29 and staged tooling PR #30 were not merged. This review branch ports their non-mutating tools and build settings to latest `main`, not their production migrations.
