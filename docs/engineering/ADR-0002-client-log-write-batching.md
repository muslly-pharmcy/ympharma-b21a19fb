# ADR-0002 — Client-side write batching for `error_logs`

- Status: Accepted
- Date: 2026-07-26
- Owners: Platform / Observability

## Context

Slow-query analysis (pg_stat_statements) ranks single-row PostgREST inserts
into `public.error_logs` at #3 by cumulative cost (~4.9s across 548 calls,
mean 8.93ms, max 194ms). Each `supabase.from('error_logs').insert(payload)`
call from browsers pays fixed planner + WAL overhead per row. The other
high-volume log tables (`uptime_checks`, `img_proxy_logs`) are written by
Lovable-managed workers outside this repo and are out of scope here.

## Decision

Introduce a client-side buffer in `src/lib/errors/supabase-sink.ts`:

- Buffer up to `BATCH_MAX = 10` payloads OR flush every
  `FLUSH_INTERVAL_MS = 3000` ms, whichever comes first.
- Hard cap `MAX_BUFFER = 50` rows to bound memory during backend outages;
  when exceeded, drop the oldest row (dedupe already collapses hot loops).
- Force-flush on `pagehide`, `beforeunload`, and `visibilitychange → hidden`
  so tab-close does not lose the last <3s of errors.
- Flush uses a single bulk `insert(rows)` call — same RLS, same size caps,
  same server-side validation as before.

Backward compatible: `sendReportToSupabase(report)` keeps its existing
signature and remains best-effort/non-throwing.

## Consequences

**Positive**
- Up to ~10× reduction in insert calls under sustained load; expected
  cumulative `error_logs` time drops proportionally.
- Fewer client → PostgREST round-trips → lower main-thread overhead on
  error-heavy sessions.

**Neutral**
- Individual errors can be delayed up to `FLUSH_INTERVAL_MS`; acceptable
  for observability, not user-facing.

**Negative / risks**
- Row loss window if the browser crashes hard before the lifecycle events
  fire; bounded to `MAX_BUFFER` rows in the worst case.

## Invalidation / operational notes

- Adjust `BATCH_MAX` / `FLUSH_INTERVAL_MS` if `error_logs` mean-ms creeps
  back above ~10ms in `pg_stat_statements`.
- `uptime_checks` / `img_proxy_logs` still dominate insert volume; batching
  there requires changes in the Lovable-managed workers and is tracked
  separately.
