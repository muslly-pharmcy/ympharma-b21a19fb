// Loaded only by the CI preview process. Never imported by application code.
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
const id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const product = { id, category_id: null, name_ar: 'منتج اختبار اصطناعي', name_en: 'Synthetic product',
  status: 'approved', is_public: true, requires_prescription: false, sbdma_official_price: 125,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }
const server = setupServer(
  http.get('https://ybhrmcdlgyccywpmiucz.supabase.co/rest/v1/:table', ({ params, request }) => {
    if (process.env.E2E_DATA_UNAVAILABLE === 'true') return HttpResponse.json({message:'synthetic outage'}, {status:503})
    const rows = params.table === 'catalog_products' ? [product] : []
    const url = new URL(request.url)
    if (params.table === 'catalog_products' && url.searchParams.has('id') && url.searchParams.get('id') !== `eq.${id}`) {
      return HttpResponse.json(null)
    }
    const single = request.headers.get('accept')?.includes('vnd.pgrst.object')
    return HttpResponse.json(single ? rows[0] ?? null : rows, { headers: { 'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}` } })
  }),
  http.head('https://ybhrmcdlgyccywpmiucz.supabase.co/rest/v1/:table', () => new HttpResponse(null, {headers:{'content-range':'*/1'}})),
)
server.listen({ onUnhandledRequest: 'bypass' })
