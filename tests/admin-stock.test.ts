import { describe, expect, it, vi } from 'vitest'
import { stockSetInput } from '@/lib/admin-stock'
import { setAdminStock } from '@/lib/admin-stock.server'

const org = '11111111-1111-4111-8111-111111111111'
const productId = '22222222-2222-4222-8222-222222222222'
const key = '33333333-3333-4333-8333-333333333333'
const input = { productId, expectedBalance: 10, newBalance: 8, idempotencyKey: key, reason: 'count correction' }

function database(found = true, error: { message: string } | null = null) {
  const eq = vi.fn(() => query)
  const query = { eq, maybeSingle: vi.fn(async () => ({ data: found ? { id: productId } : null, error: null })) }
  return {
    eq,
    from: vi.fn(() => ({ select: vi.fn(() => query) })),
    rpc: vi.fn(async () => ({ data: { ok: true, delta: -2, newBalance: 8 }, error })),
  }
}

describe('admin stock set boundary', () => {
  it('requires a UUID replay key and the observed balance', () => {
    expect(stockSetInput.safeParse({ ...input, idempotencyKey: undefined }).success).toBe(false)
    expect(stockSetInput.safeParse({ ...input, expectedBalance: undefined }).success).toBe(false)
    expect(stockSetInput.safeParse({ ...input, newBalance: Infinity }).success).toBe(false)
  })
  it('binds organization and actor from the server and uses one RPC', async () => {
    const db = database()
    await expect(setAdminStock(db, { organizationId: org, userId: 'caller' }, input)).resolves.toEqual({ ok: true, delta: -2, newBalance: 8 })
    expect(db.eq).toHaveBeenCalledWith('organization_id', org)
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith('inv_set_product_stock', {
      p_org: org, p_product: productId, p_actor: 'caller', p_expected: 10, p_new: 8, p_key: key, p_reason: 'count correction',
    })
  })
  it('rejects another organization before making a mutation', async () => {
    const db = database(false)
    await expect(setAdminStock(db, { organizationId: org, userId: 'caller' }, input)).rejects.toThrow('not in organization')
    expect(db.rpc).not.toHaveBeenCalled()
  })
  it('surfaces the SQL failure rather than reporting success or falling back to direct writes', async () => {
    const db = database(true, { message: 'STOCK_RESERVED' })
    await expect(setAdminStock(db, { organizationId: org, userId: 'caller' }, input)).rejects.toThrow('المحجوزة')
  })
})
