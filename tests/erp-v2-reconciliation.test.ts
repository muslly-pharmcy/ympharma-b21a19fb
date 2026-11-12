import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { readErpV2Reconciliation } from '@/lib/erp/v2-reconciliation.server'

const ORG = '11111111-1111-4111-8111-111111111111'
const request = (query = '') => new Request('https://unit.test/api/public/erp/v2/reconcile' + query)
function database(total: number, cap = 500, empty = false) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn(async (start: number, end: number) => ({
      data: Array.from({ length: empty ? 0 : Math.max(0, Math.min(end - start + 1, cap, total - start)) },
        (_, i) => ({ external_item: String(start + i), external_branch: 'B1' })),
      error: null, count: total,
    })),
  }
  const from = vi.fn(() => query)
  return { db: { from } as unknown as SupabaseClient, from, query }
}
type Page = { rows: { external_item: string }[]; pagination: { total: number; hasMore: boolean; nextOffset: number | null } }

describe('ERP v2 full-catalog reconciliation', () => {
  it('traverses all 6390 rows without omissions even when the server caps pages below 500', async () => {
    const { db, query } = database(6390, 200)
    const ids: string[] = []
    let offset: number | null = 0
    let pages = 0
    while (offset !== null && pages++ < 100) {
      const result = await readErpV2Reconciliation(request('?offset=' + offset), db, ORG)
      expect(result.status).toBe(200)
      const page = result.body as Page
      ids.push(...page.rows.map(row => row.external_item))
      expect(page.pagination.total).toBe(6390)
      offset = page.pagination.nextOffset
    }
    expect(offset).toBeNull()
    expect(ids).toHaveLength(6390)
    expect(new Set(ids).size).toBe(6390)
    expect(ids[6390 - 1]).toBe('6389')
    expect(query.eq.mock.calls.every(([column, value]) => column === 'org_id' && value === ORG)).toBe(true)
    expect(query.order).toHaveBeenCalledWith('external_item')
    expect(query.order).toHaveBeenCalledWith('external_branch')
  })
  it.each(['?limit=0', '?limit=501', '?offset=-1', '?offset=1.5', '?offset=2147483001',
    '?limit=1&limit=2', '?offset=0&offset=1', '?org_id=other', '?offset='])(
    'rejects malformed or unsupported paging before reading data: %s', async query => {
      const { db, from } = database(10)
      expect((await readErpV2Reconciliation(request(query), db, ORG)).status).toBe(400)
      expect(from).not.toHaveBeenCalled()
    })
  it('reports an empty catalog as complete', async () => {
    const { db } = database(0)
    const result = await readErpV2Reconciliation(request(), db, ORG)
    expect(result.status).toBe(200)
    expect((result.body as Page).pagination).toMatchObject({ total: 0, hasMore: false, nextOffset: null })
  })
  it('fails visibly when a nonempty catalog returns an empty intermediate page', async () => {
    const { db } = database(20, 500, true)
    expect((await readErpV2Reconciliation(request(), db, ORG)).status).toBe(503)
  })
  it('does not represent a failed database read as an empty complete catalog', async () => {
    const { db, query } = database(20)
    query.range.mockResolvedValueOnce({ data: [], error: null, count: 20 })
    const result = await readErpV2Reconciliation(request('?offset=20'), db, ORG)
    expect(result.status).toBe(200)
    expect((result.body as Page).pagination.nextOffset).toBeNull()
  })
})
