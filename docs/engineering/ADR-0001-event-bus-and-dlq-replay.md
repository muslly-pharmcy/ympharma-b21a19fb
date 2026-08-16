# ADR-0001 · Event Bus & DLQ Replay Contract

Status: Accepted
Date: 2026-07-26
Owners: Platform / SRE

## Context

The platform emits domain events via the SQL RPC `public.emit_domain_event`
into `public.agent_events`. A minute-level pg_cron job (`event-consumer-tick`)
was already installed via `public.schedule_event_consumer` and POSTs to
`https://<host>/api/public/hooks/event-consumer` with header
`x-cron-secret: $CRON_SECRET` and body `{ "batch": 25 }`.

Prior to this ADR **the target route did not exist**, so every tick failed
silently and `agent_events.processed_at` remained NULL for 3.4k+ rows while
`agent_events_dlq` accumulated 25 unresolved entries. A replay pattern was
observable in production data (rows with `source LIKE 'dlq-replay:%'`) but
the code that produced them was not persisted in the repository — the
replay contract was **implicit**.

## Decision

Adopt the following contract as the canonical Event Bus + DLQ Replay
interface for `public.agent_events`.

### 1. Producer

Callers use `public.emit_domain_event(name text, payload jsonb, correlation_id uuid)`
(and its domain-specific siblings: `hc_emit_event`, `inv_emit_event`,
`emit_order_event`, `emit_prescription_event`, ...). All producers write to
`public.agent_events` with `source` describing the producer subsystem.

### 2. Consumer

- SQL primitives (all `SECURITY DEFINER`, owned by `postgres`):
  - `claim_agent_events(_limit int default 25, _worker text)` —
    `FOR UPDATE SKIP LOCKED` claim of the oldest N unprocessed rows.
  - `mark_event_processed(_event_id uuid, _processed_by text)` — success ack.
  - `fail_agent_event(_event_id uuid, _processed_by text, _error text, _max_retries int default 5)`
    — on failure; auto-moves to `agent_events_dlq` at retry_count >= max.
- HTTP entrypoint: `POST /api/public/hooks/event-consumer`
  (this repo: `src/routes/api/public/hooks/event-consumer.ts`).
  - Auth: `x-cron-secret: $CRON_SECRET`.
  - Body: `{ "batch"?: number }` (default 25, cap 200).
  - Handler dispatch: `src/lib/events/handlers.server.ts` — allow-list
    registry. Missing handler ⇒ **ack-only** (audit stream semantics).
  - Response: `{ ok, claimed, processed, failed }`.

### 3. DLQ replay

Historical rows show the informal contract:

> Re-enqueue the failed event with `source := 'dlq-replay:' || original_source`
> and mark the DLQ row resolved with a resolution note.

We formalise it as `POST /api/public/hooks/dlq-reprocessor`
(this repo: `src/routes/api/public/hooks/dlq-reprocessor.ts`).

- Auth: `x-cron-secret: $CRON_SECRET`.
- Body: `{ "batch"?: number, "dlqId"?: uuid, "replayPrefix"?: string }`.
- Guardrail: batch mode skips rows whose chained replay depth already
  reached `MAX_REPLAY_CHAIN = 3`. These rows are auto-resolved with note
  `replay-chain-exceeded`. Admins can still force-replay by `dlqId`.
- Behaviour:
  1. `INSERT INTO agent_events` (new occurred_at, prefixed source, same
     payload / correlation_id / entity).
  2. `UPDATE agent_events_dlq SET resolved_at = now(),
     resolution_note = 'replayed by dlq-reprocessor' WHERE id = row.id`.

## Options considered

| Option | Summary | Trade-off | Chosen |
|---|---|---|---|
| **A. HTTP consumer + HTTP replayer (this ADR)** | pg_cron → route → RPC | Reuses existing `claim_agent_events` contract, matches historical replay pattern, keeps handlers in TypeScript. | ✅ |
| B. In-DB consumer (`plpgsql` handler map) | pg_cron calls a plpgsql fn that dispatches inline | Zero network hops. Requires porting every side-effect (email, HTTP, AI gateway) into plpgsql — impractical. | ❌ |
| C. External queue (Redis / pgmq / SQS) | Bridge `agent_events` into a queue and consume from there | Adds infra + at-least-once semantics we already have via SKIP LOCKED. | ❌ |

## Consequences

- The Worker route is the only choke-point; it must remain fast (≤ few
  seconds per tick) or the batch must shrink. `event-consumer` already
  processes 25 rows/min with room to grow to 200.
- Ack-only default means new event families become part of the audit
  stream without opt-in code. Downstream side-effects are opt-in via
  `HANDLERS` — this keeps blast radius small.
- Replay depth cap is opinionated (3). Adjust via `MAX_REPLAY_CHAIN` if
  operational data proves it too aggressive.

## Follow-up work

- Wire per-agent error-budget alert on `fail_agent_event` volume
  (Prometheus / Sentry). Tracked in Production Readiness Dashboard §8.
- Install pg_cron schedule for the DLQ reprocessor. Requires elevated
  privileges on the `cron` schema — SQL is committed at
  `docs/engineering/sql/schedule-dlq-reprocessor.sql` and must be applied
  by a Supabase project owner. See "Deployment" below.

## Deployment

1. Ensure `CRON_SECRET` is set in the server environment (already required
   by `event-consumer-tick`).
2. Deploy code (event-consumer + dlq-reprocessor routes) via the normal
   preview → publish flow.
3. Apply `docs/engineering/sql/schedule-dlq-reprocessor.sql` **from a
   role with GRANT on schema `cron`** (project owner). Verify via
   `SELECT public.get_dlq_reprocessor_schedule();` (added by the same
   SQL file).
