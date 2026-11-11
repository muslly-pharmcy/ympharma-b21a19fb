import { createFileRoute } from '@tanstack/react-router'
import { erpV2Handle } from '@/lib/erp/v2-handler.server'

// HMAC covers the full route + query; returns only this organization's
// authorized retail snapshot, never purchase cost or clinical data.
export const Route = createFileRoute('/api/public/erp/v2/reconcile')({
  server: {
    handlers: {
      GET: ({ request }) =>
        erpV2Handle(request, '/api/public/erp/v2/reconcile', async (_body, db, organizationId) => {
          const url = new URL(request.url)
          if (url.search) return { status: 400, body: { error: 'unsupported_query' } }
          const { data, error } = await db
            .from('erp2_stock_snapshots')
            .select('external_item,external_branch,source_version,qty_available,unit_code,selling_price,official_reference_price,currency')
            .eq('org_id', organizationId)
            .order('external_item')
            .order('external_branch')
            .limit(5000)
          if (error) return { status: 503, body: { error: 'erp_v2_reconciliation_unavailable' } }
          return { status: 200, body: { organizationId, rows: data ?? [] } }
        }),
    },
  },
})
