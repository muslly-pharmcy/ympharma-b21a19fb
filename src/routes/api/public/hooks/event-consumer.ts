// Agent event bus consumer.
//
// Cron-invoked every minute by `event-consumer-tick` (installed via
// `public.schedule_event_consumer`). Claims a batch of unprocessed rows
// from `public.agent_events` with FOR UPDATE SKIP LOCKED, dispatches each
// to the registered handler, then acks or fails through the existing SQL
// contract (`mark_event_processed` / `fail_agent_event`). Unknown event
// names are ack'd as audit-only records.
//
// Auth: shared `x-cron-secret` header matched against `CRON_SECRET`.
// Body : `{ batch?: number }` (default 25, capped at 200).
import { createFileRoute } from '@tanstack/react-router'
import { timingSafeEqual } from 'node:crypto'
import { getHandler, type AgentEvent } from '@/lib/events/handlers.server'

const WORKER_ID = 'event-consumer'

function verifyCronSecret(request: Request): boolean {
  const provided = request.headers.get('x-cron-secret') ?? ''
  const expected = process.env.CRON_SECRET ?? ''
  if (!expected) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export const Route = createFileRoute('/api/public/hooks/event-consumer')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyCronSecret(request)) {
          return new Response('unauthorized', { status: 401 })
        }

        let batch = 25
        try {
          const body = (await request.json().catch(() => ({}))) as { batch?: number }
          if (typeof body.batch === 'number' && Number.isFinite(body.batch)) {
            batch = Math.max(1, Math.min(200, Math.floor(body.batch)))
          }
        } catch { /* default */ }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { data: claimed, error: claimErr } = await (supabaseAdmin.rpc as unknown as (
          name: string, args: unknown,
        ) => Promise<{ data: AgentEvent[] | null; error: { message: string } | null }>)(
          'claim_agent_events', { _limit: batch, _worker: WORKER_ID },
        )
        if (claimErr) {
          console.error('[event-consumer] claim failed', claimErr.message)
          return new Response(JSON.stringify({ ok: false, error: claimErr.message }), { status: 500 })
        }
        const events = claimed ?? []
        if (events.length === 0) {
          return Response.json({ ok: true, claimed: 0, processed: 0, failed: 0 })
        }

        let processed = 0
        let failed = 0
        for (const ev of events) {
          try {
            const handler = getHandler(ev.event_name)
            if (handler) await handler(ev)
            const { error } = await (supabaseAdmin.rpc as unknown as (
              name: string, args: unknown,
            ) => Promise<{ error: { message: string } | null }>)(
              'mark_event_processed', { _event_id: ev.id, _processed_by: WORKER_ID },
            )
            if (error) throw new Error(error.message)
            processed++
          } catch (err) {
            failed++
            const msg = err instanceof Error ? err.message : String(err)
            await (supabaseAdmin.rpc as unknown as (
              name: string, args: unknown,
            ) => Promise<{ error: { message: string } | null }>)(
              'fail_agent_event',
              { _event_id: ev.id, _processed_by: WORKER_ID, _error: msg.slice(0, 500) },
            )
            console.error('[event-consumer] handler failed', { id: ev.id, name: ev.event_name, error: msg })
          }
        }

        return Response.json({ ok: true, claimed: events.length, processed, failed })
      },
    },
  },
})
