# Privileged maintenance RPCs — 2026-11-12

## Production database change

Project `ybhrmcdlgyccywpmiucz`, migration `20261111221813` applied. Four SECURITY DEFINER maintenance functions previously callable by `authenticated` without validating a user/tenant context:
- `monitor_cron_failures()` — reads scheduler runs, creates alerts.
- `reconcile_inventory_mismatch()` — records mismatch alerts (does not rebalance stock).
- `run_retention_policy()` — archives/deletes expired operational logs; active cron job `retention-daily` runs as `postgres`.
- `weekly_exec_report_build()` — reads cross-system reports, writes executive reports.

After: `authenticated=false`, `anon=false`, `service_role=true`, `postgres=true` for all four. Signed-in callable SECURITY DEFINER count decreased from 173 to **169**. No data was mutated by the GRANT/REVOKE migration. Code uses these routines in SQL/migrations, and no direct UI caller was located in current repository search. This is not a proof no external caller exists: monitor admin scheduled jobs in staging.

## Acceptance still required
- Two-organization signed-in tests for all critical business RPCs and RLS.
- Scheduled retention job and reporting worker end-to-end smoke test.
- Remediation of other 169 signed-in and 6 anonymous callable SECURITY DEFINER findings per-function, not broad revoke.
- Cloudflare and ERP financial staging acceptance before production merge.
