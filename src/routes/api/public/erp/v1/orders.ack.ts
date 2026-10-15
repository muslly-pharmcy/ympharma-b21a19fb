import { createFileRoute } from '@tanstack/react-router'
import { erpHandle } from '@/lib/erp/handler.server'
import { acknowledgeBridgeOrder } from '@/lib/erp/orders.server'
// Durable ACK only; never increases availability. Production gate remains closed.
export const Route = createFileRoute('/api/public/erp/v1/orders/ack')({ server: { handlers: { POST: ({ request }) =>
  erpHandle(request, '/api/public/erp/v1/orders/ack', (body,db,context) => acknowledgeBridgeOrder(body,db,context.source))
} } })
