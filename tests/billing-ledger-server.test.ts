import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'
import { readBillingLedger } from '@/lib/billing-ledger.server'

const now = new Date('2026-11-16T10:00:00Z')
const row = { id: 'test', entry_type: 'adjustment', amount_yer: '1250.1234', notes: null, created_at: '2026-11-16T00:00:00Z' }
function fixture({ admin = true, roleError = false, queryError = false, rows = [row] } = {}) {
  const query = {
    select: vi.fn(() => query), gte: vi.fn(() => query), lt: vi.fn(() => query), order: vi.fn(() => query),
    limit: vi.fn(async () => ({ data: rows, error: queryError ? { message: 'synthetic SQL failure' } : null })),
  }
  const from = vi.fn(() => query)
  const rpc = vi.fn(async () => ({ data: admin, error: roleError ? { message: 'auth failure' } : null }))
  return { query, from, rpc, context: { userId: 'caller', supabase: { from, rpc } as unknown as SupabaseClient<Database> } }
}

describe('billing read authorization and contract', () => {
  it.each([{ admin: false }, { roleError: true }])('denies unauthorized/failed role reads before the table query', async (options) => {
    const f = fixture(options)
    await expect(readBillingLedger(f.context, 'day', now)).rejects.toThrow('غير مصرح')
    expect(f.from).not.toHaveBeenCalled()
  })
  it('uses real schema columns and server-side half-open bounds', async () => {
    const f = fixture()
    const result = await readBillingLedger(f.context, 'day', now)
    expect(f.rpc).toHaveBeenCalledWith('has_role', { _user_id: 'caller', _role: 'admin' })
    expect(f.query.select).toHaveBeenCalledWith('id, entry_type, amount_yer, notes, created_at')
    expect(f.query.gte).toHaveBeenCalledWith('created_at', '2026-11-15T21:00:00.000Z')
    expect(f.query.lt).toHaveBeenCalledWith('created_at', '2026-11-16T21:00:00.000Z')
    expect(result.items[0].amount_yer).toBe('1250.1234')
  })
  it('throws on SQL failure rather than returning a financial zero', async () => {
    const f = fixture({ queryError: true })
    await expect(readBillingLedger(f.context, 'month', now)).rejects.toThrow('تعذر تحميل')
  })
  it('marks a bounded list explicitly instead of treating it as the period total', async () => {
    const f = fixture({ rows: Array.from({ length: 101 }, (_, i) => ({ ...row, id: String(i) })) })
    const result = await readBillingLedger(f.context, 'year', now)
    expect(result.items).toHaveLength(100)
    expect(result.truncated).toBe(true)
  })
  it('keeps valid empty data distinct from a failed query', async () => {
    const f = fixture({ rows: [] })
    await expect(readBillingLedger(f.context, 'week', now)).resolves.toEqual({ items: [], truncated: false })
  })
})
