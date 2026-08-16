// DLQ reprocessor.
//
// Re-enqueues unresolved rows from `public.agent_events_dlq` back onto
// `public.agent_events` with `source` prefixed `dlq-replay:<original_source>`
// and marks the DLQ row resolved. Matches the historical replay contract
// visible in production data (see ADR-0001).
//
// Runs on cron; also invokable ad-hoc by admins for a specific dlq id.
// Auth: shared `x-cron-secret` header matched against `CRON_SECRET`.
// Body : `{ batch?: number, dlqId?: string, replayPrefix?: string }`
//        - `batch`  default 50, cap 500
//        - `dlqId`  when set, replays exactly that DLQ row (bypasses batch)
//        - `replayPrefix` default 'dlq-replay:' — safeguard to prevent
//                        infinite replays, only rows whose current source
//                        does NOT already start with this prefix twice
//                        are eligible in batch mode.
import { createFileRoute } from '@tanstack/react-router'
import { timingSafeEqual } from 'node:crypto'

const WORKER_ID = 'dlq-reprocessor'
const DEFAULT_PREFIX = 'dlq-replay:'
// Guardrail: cap chained replays so a permanently-poisonous event cannot
// grow the source string unbounded (`dlq-replay:dlq-replay:...`).
const MAX_REPLAY_CHAIN = 3

function verifyCronSecret(request: Request): boolean {
  const provided = request.headers.get('x-cron-secret') ?? ''
  const expected = process.env.CRON_SECRET ?? ''
  if (!expected) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

interface DlqRow {
  id: string
  original_id: string
  event_name: string
  entity_type: string | null
  entity_id: string | null
  payload: Record<string, unknown>
  source: string
  occurred_at: string
  retry_count: number
  correlation_id: string | null
}

function chainDepth(source: string, prefix: string): number {
  let depth = 0
  let s = source
  while (s.startsWith(prefix)) { depth++; s = s.slice(prefix.length) }
  return depth
}

export const Route = createFileRoute('/api/public/hooks/dlq-reprocessor')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyCronSecret(request)) {
          return new Response('unauthorized', { status: 401 })
        }

        const body = (await request.json().catch(() => ({}))) as {
          batch?: number; dlqId?: string; replayPrefix?: string
        }
        const prefix = body.replayPrefix ?? DEFAULT_PREFIX
        const batch = Math.max(1, Math.min(500, Math.floor(body.batch ?? 50)))

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

        let rows: DlqRow[]
        if (body.dlqId) {
          const { data, error } = await supabaseAdmin
            .from('agent_events_dlq')
            .select('id, original_id, event_name, entity_type, entity_id, payload, source, occurred_at, retry_count, correlation_id')
            .eq('id', body.dlqId)
            .is('resolved_at', null)
            .limit(1)
          if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 })
          rows = (data ?? []) as DlqRow[]
        } else {
          const { data, error } = await supabaseAdmin
            .from('agent_events_dlq')
            .select('id, original_id, event_name, entity_type, entity_id, payload, source, occurred_at, retry_count, correlation_id')
            .is('resolved_at', null)
            .order('failed_at', { ascending: true })
            .limit(batch)
          if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 })
          rows = (data ?? []) as DlqRow[]
        }

        if (rows.length === 0) {
          return Response.json({ ok: true, replayed: 0, skipped: 0 })
        }

        let replayed = 0
        let skipped = 0
        for (const row of rows) {
          if (!body.dlqId && chainDepth(row.source, prefix) >= MAX_REPLAY_CHAIN) {
            // Mark as unresolvable so it stops re-appearing in the batch;
            // an admin can still replay it explicitly by id.
            await supabaseAdmin
              .from('agent_events_dlq')
              .update({
                resolved_at: new Date().toISOString(),
                resolved_by: null,
                resolution_note: `replay-chain-exceeded (>=${MAX_REPLAY_CHAIN})`,
              })
              .eq('id', row.id)
            skipped++
            continue
          }

          const { error: insErr } = await supabaseAdmin.from('agent_events').insert({
            event_name: row.event_name,
            entity_type: row.entity_type,
            entity_id: row.entity_id,
            payload: row.payload as never,
            source: `${prefix}${row.source}`,
            occurred_at: new Date().toISOString(),
            correlation_id: row.correlation_id,
          })
          if (insErr) {
            console.error('[dlq-reprocessor] re-enqueue failed', { id: row.id, error: insErr.message })
            skipped++
            continue
          }
          await supabaseAdmin
            .from('agent_events_dlq')
            .update({
              resolved_at: new Date().toISOString(),
              resolution_note: `replayed by ${WORKER_ID}`,
            })
            .eq('id', row.id)
          replayed++
        }

        return Response.json({ ok: true, replayed, skipped, considered: rows.length })
      },
    },
  },
})
