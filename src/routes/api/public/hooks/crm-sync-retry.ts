import { createFileRoute } from '@tanstack/react-router'
import { timingSafeEqual } from 'node:crypto'

function authorized(request: Request): boolean {
  const provided = request.headers.get('x-cron-secret') ?? ''
  const expected = process.env['CRON_SECRET'] ?? ''
  if (!expected) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

// Hourly retry of pending Google Sheets CRM rows. Shared-secret protected.
export const Route = createFileRoute('/api/public/hooks/crm-sync-retry')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!process.env['CRON_SECRET']) return new Response('cron secret not configured', { status: 500 })
        if (!authorized(request)) return new Response('unauthorized', { status: 401 })

        const { retryPendingCrmSync, syncNewRegistrations } = await import(
          '@/lib/integrations/google-sheets/sync.server'
        )
        try {
          const registrations = await syncNewRegistrations()
          const result = await retryPendingCrmSync(100)
          return Response.json({ ok: true, ...result, registrations: registrations.synced })
        } catch (e) {
          console.error('[crm-sync-retry]', e)
          return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), { status: 500 })
        }
      },
    },
  },
})
