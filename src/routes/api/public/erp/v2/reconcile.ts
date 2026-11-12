import { createFileRoute } from '@tanstack/react-router'
import { erpV2Handle } from '@/lib/erp/v2-handler.server'
import { readErpV2Reconciliation } from '@/lib/erp/v2-reconciliation.server'

// The guard signs the complete query and binds every page to the tenant.
export const Route = createFileRoute('/api/public/erp/v2/reconcile')({
  server: {
    handlers: {
      GET: ({ request }) =>
        erpV2Handle(request, '/api/public/erp/v2/reconcile', async (_body, db, organizationId) =>
          readErpV2Reconciliation(request, db, organizationId)),
    },
  },
})
