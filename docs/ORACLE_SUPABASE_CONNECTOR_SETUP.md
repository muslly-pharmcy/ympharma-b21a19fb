# Oracle Pharmacy Online → Supabase connector

This integration is deliberately one-way and read-only on Oracle. The pharmacy
computer opens outbound HTTPS only; it never exposes Oracle to the internet and
never stores a Supabase service-role key.

## Components

- `scripts/oracle-provider-healthcheck.ps1`: provider and login health check.
- `scripts/oracle-supabase-sync.ps1`: signed batch connector for 32-bit OraOLEDB.
- `config/oracle-sync.mapping.example.json`: source-view mapping contract.
- `supabase/functions/oracle-sync-ingest/index.ts`: HMAC-protected receiver.
- `supabase/migrations/20260816042051_oracle_sync_staging.sql`: locked staging and run logs.

## Project topology

- `swyqqlpbjemarzzdxctw` is the storefront/Lovable database recorded in
  `supabase/config.toml`. It owns the real catalog, roles, orders, and pharmacy
  application schema.
- `ybhrmcdlgyccywpmiucz` is an isolated Oracle gateway prototype. It must not be
  used as `VITE_SUPABASE_URL` because it does not contain the storefront schema.
- The gateway prototype has an active `oracle-pharmacy-sync` function, but it is
  not operational until its HMAC secret is configured; the latest health calls
  returned HTTP 503. Its experimental admin helpers were locked fail-closed on
  2026-08-16, and the exact migration is preserved under
  `supabase/gateway-migrations/`.

The production recommendation remains to deploy `oracle-sync-ingest` into the
storefront database so reviewed Oracle products reach the canonical catalog
without a second cross-project service-role bridge. If the isolated gateway is
retained, a separate signed promotion bridge must be designed and approved.

## Security model

1. Create a dedicated Oracle account with `CREATE SESSION` and `SELECT` only on
   approved read-only views. Do not grant table writes or broad DBA roles.
2. Generate one random HMAC secret. Store it as `ORACLE_SYNC_HMAC_SECRET` in
   Supabase Edge Function secrets and enter it interactively on the pharmacy PC.
3. The Edge Function keeps the Supabase server key on Supabase only.
4. Every request is signed over `timestamp.rawBody`, limited to five minutes,
   one megabyte, and 500 rows.
5. Staging tables have RLS enabled and no grants for `anon` or `authenticated`.

## Deployment

Apply the migration, set `ORACLE_SYNC_HMAC_SECRET`, then deploy
`oracle-sync-ingest` with JWT verification disabled because the function performs
its own HMAC authentication. The checked-in `supabase/config.toml` records this.

The connected Supabase plugin currently exposes only the isolated gateway
project. It still needs access to `swyqqlpbjemarzzdxctw`, or Lovable must be
re-authorized with `projects:write`, before storefront deployment can be
automated.

## Oracle mapping and first run

Run the provider and mapping validation without credentials or network writes:

```powershell
C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe -NoProfile -File .\scripts\oracle-supabase-sync.ps1 -ValidateOnly
```

After the read-only Oracle account is available, query `ALL_TABLES` and
`ALL_TAB_COLUMNS`, replace the placeholder view names in the mapping file, and
enable one entity at a time. Start without `-Apply`; this sends a signed dry-run
that validates and stages rows but does not update the public catalog.

The bundled discovery tool performs that dictionary-only scan and writes no row
data from the pharmacy system:

```powershell
C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe -NoProfile -File .\scripts\oracle-schema-discovery.ps1
```

Only products are promoted automatically in the first release, keyed by
`catalog_products.store_code`. Barcode, warehouse, price, quantity, batch, and
expiry payloads remain staged until the exact Oracle views, organization, and
warehouse identifiers are approved. This prevents guessed mappings from changing
inventory or official medicine prices.

New Oracle products are deliberately created as non-public drafts that require
pharmacist review. Existing products keep their current publication and
prescription status while their descriptive Oracle fields are refreshed.

When the dry-run report is correct, repeat with `-Apply`. Oracle remains
read-only in both modes.
