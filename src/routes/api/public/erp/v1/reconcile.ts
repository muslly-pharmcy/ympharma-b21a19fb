import { createFileRoute } from '@tanstack/react-router'
import { erpHandle } from '@/lib/erp/handler.server'
import { decodeCursor, encodeCursor, type StockCursor } from '@/lib/erp/cursor'
export const Route = createFileRoute('/api/public/erp/v1/reconcile')({ server: { handlers: { GET: ({ request }) =>
  erpHandle(request, '/api/public/erp/v1/reconcile', async (_body, db, context) => {
    const params = new URL(request.url).searchParams
    let cursor: StockCursor | null
    try { cursor = decodeCursor<StockCursor>(params.get('cursor'), 'stock') } catch { return { status: 400, body: { error: 'invalid_cursor' } } }
    const size = params.get('limit') ?? '100'
    if (!/^[1-9][0-9]{0,2}$/.test(size) || Number(size) > 100) return { status: 400, body: { error: 'invalid_limit' } }
    const { data, error } = await db.rpc('erp_v2_reconcile', { p_source: context.source, p_item: cursor?.item ?? '', p_branch: cursor?.branch ?? '', p_limit: Number(size) })
    if (error || !Array.isArray(data)) return { status: 503, body: { error: 'read_failed' } }
    const more = data.length > Number(size), rows = data.slice(0, Number(size)), last = rows.at(-1)
    return { status: 200, body: { rows, next: more && last ? encodeCursor({ item: last.erp_item_id, branch: last.erp_branch_id }) : null, staging_only: true } }
  })
} } })
