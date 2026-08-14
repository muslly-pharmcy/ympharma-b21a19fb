// Legacy inbound WhatsApp webhook path kept for callers configured before the
// move to /api/public/hooks/whatsapp. Same security contract: Meta verification
// handshake on GET, HMAC-SHA256 signature verification on POST.
import { createFileRoute } from '@tanstack/react-router'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { newCorrelationId } from '@/lib/errors/correlation'

function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header || !header.startsWith('sha256=')) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const a = Buffer.from(header.slice('sha256='.length), 'hex')
  const b = Buffer.from(expected, 'hex')
  if (a.length === 0 || a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export const Route = createFileRoute('/api/whatsapp-webhook')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const expected = process.env['WHATSAPP_VERIFY_TOKEN'] ?? ''
        if (!expected) return new Response('not configured', { status: 500 })
        const mode = url.searchParams.get('hub.mode')
        const token = url.searchParams.get('hub.verify_token')
        const challenge = url.searchParams.get('hub.challenge')
        if (mode === 'subscribe' && token && challenge) {
          const a = Buffer.from(token)
          const b = Buffer.from(expected)
          if (a.length === b.length && timingSafeEqual(a, b)) {
            return new Response(challenge, {
              status: 200,
              headers: { 'content-type': 'text/plain' },
            })
          }
        }
        return new Response('forbidden', { status: 403 })
      },
      POST: async ({ request }) => {
        const correlationId = newCorrelationId('wa-legacy')
        const secret = process.env['WHATSAPP_APP_SECRET'] ?? ''
        if (!secret) {
          console.error('[whatsapp-webhook] missing WHATSAPP_APP_SECRET', { correlationId })
          return new Response('ok', { status: 200 })
        }
        const raw = await request.text()
        if (!verifySignature(raw, request.headers.get('x-hub-signature-256'), secret)) {
          console.warn('[whatsapp-webhook] bad signature', { correlationId })
          return new Response('invalid signature', { status: 401 })
        }
        let envelope: unknown = {}
        try {
          envelope = JSON.parse(raw)
        } catch {
          return new Response('ok', { status: 200 })
        }
        try {
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
          await supabaseAdmin
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .from('whatsapp_events' as any)
            .upsert(
              [
                {
                  message_id: `legacy:${correlationId}`,
                  event_type: 'raw',
                  direction: 'inbound',
                  payload: envelope,
                  correlation_id: correlationId,
                },
              ],
              { onConflict: 'message_id', ignoreDuplicates: true },
            )
        } catch (e) {
          console.error('[whatsapp-webhook] persist failed', {
            correlationId,
            err: (e as Error).message,
          })
        }
        return new Response('ok', { status: 200 })
      },
    },
  },
})
