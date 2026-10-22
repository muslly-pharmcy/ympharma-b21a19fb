import { createFileRoute } from '@tanstack/react-router'
import { erpHandle } from '@/lib/erp/handler.server'
import { pendingBridgeOrders } from '@/lib/erp/orders.server'
// Durable source-scoped event feed. Production gate remains closed in erpHandle.
export const Route = createFileRoute('/api/public/erp/v1/orders/pending')({ server: { handlers: { GET: ({ request }) =>
  erpHandle(request, '/api/public/erp/v1/orders/pending', (_body,db,context) => pendingBridgeOrders(context.target,db,context.source))
} } })
