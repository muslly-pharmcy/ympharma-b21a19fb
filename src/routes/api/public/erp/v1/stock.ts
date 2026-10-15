import { createFileRoute } from '@tanstack/react-router'
import { erpHandle } from '@/lib/erp/handler.server'
import { applyStockRequest } from '@/lib/erp/stock.server'
export const Route = createFileRoute('/api/public/erp/v1/stock')({ server: { handlers: { POST: ({ request }) => erpHandle(request, '/api/public/erp/v1/stock', applyStockRequest) } } })
