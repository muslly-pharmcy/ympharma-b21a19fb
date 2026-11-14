import type { SupabaseClient } from '@supabase/supabase-js'
import type { ErpV2Result } from './v2-handler.server'

// Pages are a live ordered view, not a transactionally frozen export.
// Re-run reconciliation if the producer changes mappings during traversal.
export async function readErpV2Reconciliation(
  request: Request, db: SupabaseClient, organizationId: string,
): Promise<ErpV2Result> {
  const params = new URL(request.url).searchParams
  if ([...params.keys()].some(k => !['offset', 'limit'].includes(k))
    || params.getAll('offset').length > 1 || params.getAll('limit').length > 1) {
    return { status: 400, body: { error: 'unsupported_query' } }
  }
  const rawOffset = params.get('offset') ?? '0'
  const rawLimit = params.get('limit') ?? '500'
  if (!/^(0|[1-9][0-9]{0,9})$/.test(rawOffset) || !/^[1-9][0-9]{0,2}$/.test(rawLimit)) {
    return { status: 400, body: { error: 'invalid_pagination' } }
  }
  const offset = Number(rawOffset)
  const limit = Number(rawLimit)
  if (limit > 500 || offset > 2_147_483_000) {
    return { status: 400, body: { error: 'invalid_pagination' } }
  }
  const { data, error, count } = await db
    .from('erp2_stock_snapshots')
    .select('external_item,external_branch,source_version,qty_available,unit_code,selling_price,official_reference_price,currency', { count: 'exact' })
    .eq('org_id', organizationId)
    .order('external_item')
    .order('external_branch')
    .range(offset, offset + limit - 1)
  if (error || count === null || !Number.isSafeInteger(count) || count < 0 || !Array.isArray(data)) {
    return { status: 503, body: { error: 'erp_v2_reconciliation_unavailable' } }
  }
  const end = offset + data.length
  // Advance by returned rows: a server cap below the requested page size
  // must not silently skip rows. An empty intermediate page is incomplete.
  if (data.length === 0 && offset < count) {
    return { status: 503, body: { error: 'erp_v2_reconciliation_incomplete' } }
  }
  return {
    status: 200,
    body: {
      organizationId, rows: data,
      pagination: { offset, limit, total: count, hasMore: end < count, nextOffset: end < count ? end : null },
    },
  }
}
