import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { erpHandle } from '@/lib/erp/handler.server'

// ERP acknowledges review outcome. Only records the ERP decision; never auto-confirms
// dispensing, medical approval, or payment on the website side.
const ack = z.object({
  orderId: z.string().uuid(),
  status: z.enum(['received', 'accepted', 'rejected']),
})

export const Route = createFileRoute('/api/public/erp/v1/orders/ack')({
  server: {
    handlers: {
      POST: ({ request }) =>
        erpHandle(request, '/api/public/erp/v1/orders/ack', async (body, db) => {
          const p = ack.safeParse(body)
          if (!p.success) return { status: 400, body: { error: 'invalid_body' } }
          const { data, error } = await db
            .from('erp_outbound_queue')
            .update({ erp_ack_status: p.data.status, updated_at: new Date().toISOString() })
            .eq('order_id', p.data.orderId)
            .select('order_id')
          if (error) return { status: 500, body: { error: 'update_failed' } }
          if (!data?.length) return { status: 404, body: { error: 'order_not_queued' } }
          return { status: 200, body: { orderId: p.data.orderId, erpStatus: p.data.status } }
        }),
    },
  },
})
