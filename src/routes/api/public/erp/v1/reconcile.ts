import { createFileRoute } from '@tanstack/react-router'
import { erpHandle } from '@/lib/erp/handler.server'

// Returns item/branch/version/qty so ERP can verify the website copy matches. No costs exposed.
export const Route = createFileRoute('/api/public/erp/v1/reconcile')({
  server: {
    handlers: {
      GET: ({ request }) =>
        erpHandle(request, '/api/public/erp/v1/reconcile', async (_b, db) => {
          const { data, error } = await db
            .from('erp_stock_snapshots')
            .select('erp_item_id,erp_branch_id,source_version,qty_available,unit_code,selling_price,currency')
            .order('erp_item_id')
            .limit(5000)
          if (error) return { status: 500, body: { error: 'read_failed' } }
          return { status: 200, body: { rows: data } }
        }),
    },
  },
})
