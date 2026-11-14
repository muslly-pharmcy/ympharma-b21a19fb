import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { erpV2Handle } from '@/lib/erp/v2-handler.server'

const ack = z.object({
  orderId: z.string().min(1).max(180),
  status: z.enum(['received', 'accepted', 'rejected']),
}).strict()

export const Route = createFileRoute('/api/public/erp/v2/orders/ack')({
  server: {
    handlers: {
      POST: ({ request }) =>
        erpV2Handle(request, '/api/public/erp/v2/orders/ack', async (payload, db, organizationId) => {
          const parsed = ack.safeParse(payload)
          if (!parsed.success) return { status: 400, body: { error: 'invalid_acknowledgement' } }
          // ACK records the external review state ONLY. It does not dispense,
          // invoice, settle a payment, or deduct inventory.
          const { data, error } = await db
            .from('erp2_outbound_queue')
            .update({
              erp_ack_status: parsed.data.status,
              status: parsed.data.status === 'received' ? 'pending_erp_review' : 'reviewed',
              updated_at: new Date().toISOString(),
            })
            .eq('org_id', organizationId)
            .eq('order_id', parsed.data.orderId)
            .eq('status', 'pending_erp_review')
            .select('order_id')
          if (error) return { status: 503, body: { error: 'erp_v2_ack_unavailable' } }
          if (!data?.length) return { status: 404, body: { error: 'order_not_queued_for_organization' } }
          return { status: 200, body: { orderId: parsed.data.orderId, erpStatus: parsed.data.status } }
        }),
    },
  },
})
