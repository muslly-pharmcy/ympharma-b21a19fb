// WhatsApp Cloud API webhook.
// - GET  : Meta verification handshake (hub.mode/hub.verify_token/hub.challenge).
// - POST : Event delivery, HMAC-SHA256 verified using WHATSAPP_APP_SECRET.
// All logic lives in src/lib/whatsapp/webhook.server.ts so the legacy path
// (/api/whatsapp-webhook) shares exactly the same security contract.
import { createFileRoute } from '@tanstack/react-router'
import { newCorrelationId } from '@/lib/errors/correlation'
import { handleInboundPost, handleVerification } from '@/lib/whatsapp/webhook.server'

export const Route = createFileRoute('/api/public/hooks/whatsapp')({
  server: {
    handlers: {
      GET: async ({ request }) => handleVerification(request),
      POST: async ({ request }) => handleInboundPost(request, newCorrelationId('wa')),
    },
  },
})
