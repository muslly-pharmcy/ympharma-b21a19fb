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

// Daily executive report (21:00 Asia/Aden) — emails the owner and returns a
// 1-click WhatsApp summary link. Shared-secret protected.
export const Route = createFileRoute('/api/public/hooks/daily-report')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!process.env['CRON_SECRET']) return new Response('cron secret not configured', { status: 500 })
        if (!authorized(request)) return new Response('unauthorized', { status: 401 })

        const { dispatchDailyReport } = await import('@/lib/reports/daily-dispatcher.server')
        try {
          const result = await dispatchDailyReport()
          return Response.json({ ok: true, emailQueued: result.emailQueued, whatsappUrl: result.whatsappUrl })
        } catch (e) {
          console.error('[daily-report hook]', e)
          return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), { status: 500 })
        }
      },
    },
  },
})
