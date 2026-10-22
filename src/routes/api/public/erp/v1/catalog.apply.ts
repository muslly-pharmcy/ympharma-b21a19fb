import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/api/public/erp/v1/catalog/apply')({
  server: { handlers: { POST: async ({ request }) => {
    const { erpHandle } = await import('@/lib/erp/handler.server')
    const { applyCatalogRequest } = await import('@/lib/erp/catalog.server')
    return erpHandle(request, '/api/public/erp/v1/catalog/apply', applyCatalogRequest)
  } } },
})
