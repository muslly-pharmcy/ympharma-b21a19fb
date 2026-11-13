import { createFileRoute } from '@tanstack/react-router'
import { erpV2Handle } from '@/lib/erp/v2-handler.server'

// Server-owned queue has no automatic producer until reviewed source-to-order
// organization binding exists. No patient details are intentionally emitted.
export const Route = createFileRoute('/api/public/erp/v2/orders/pending')({
  server: {
    handlers: {
      GET: ({ request }) =>
        erpV2Handle(request, '/api/public/erp/v2/orders/pending', async (_body, db, organizationId) => {
          const url = new URL(request.url)
          const params = [...url.searchParams.keys()]
          if (params.some(k => k !== 'limit') || url.searchParams.getAll('limit').length > 1) {
            return { status: 400, body: { error: 'unsupported_query' } }
          }
          const rawLimit = url.searchParams.get('limit') ?? '100'
          if (!/^[0-9]{1,3}$/.test(rawLimit)) return { status: 400, body: { error: 'invalid_limit' } }
          const limit = Number(rawLimit)
          if (limit < 1 || limit > 100) return { status: 400, body: { error: 'invalid_limit' } }
          const { data, error } = await db
            .from('erp2_outbound_queue')
            .select('order_id,payload,status,created_at')
            .eq('org_id', organizationId)
            .eq('status', 'pending_erp_review')
            .order('created_at', { ascending: true })
            .order('order_id', { ascending: true })
            .limit(limit)
          if (error) return { status: 503, body: { error: 'erp_v2_orders_unavailable' } }
          return { status: 200, body: { organizationId, orders: data ?? [] } }
        }),
    },
  },
})
