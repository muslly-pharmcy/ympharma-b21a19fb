import { createFileRoute } from '@tanstack/react-router'
import { erpHandle } from '@/lib/erp/handler.server'

// ERP pulls orders awaiting review. Minimal fields only; no patient PII.
export const Route = createFileRoute('/api/public/erp/v1/orders/pending')({
  server: {
    handlers: {
      GET: ({ request }) =>
        erpHandle(request, '/api/public/erp/v1/orders/pending', async (_b, db) => {
          const after = new URL(request.url).searchParams.get('after') ?? '1970-01-01'
          const { data, error } = await db
            .from('erp_outbound_queue')
            .select('order_id,payload,status,created_at')
            .eq('status', 'pending_erp_review')
            .gt('created_at', after)
            .order('created_at')
            .limit(100)
          if (error) return { status: 500, body: { error: 'read_failed' } }
          return { status: 200, body: { orders: data, next: data.at(-1)?.created_at ?? null } }
        }),
    },
  },
})
