// Legacy inbound WhatsApp webhook path, kept for callers configured before the
// move to /api/public/hooks/whatsapp. Identical security contract — both routes
// delegate to the same shared handler module.
import { createFileRoute } from '@tanstack/react-router'
import { newCorrelationId } from '@/lib/errors/correlation'
import { handleInboundPost, handleVerification } from '@/lib/whatsapp/webhook.server'

export const Route = createFileRoute('/api/whatsapp-webhook')({
  server: {
    handlers: {
      GET: async ({ request }) => handleVerification(request),
      POST: async ({ request }) => handleInboundPost(request, newCorrelationId('wa-legacy')),
    },
  },
})
