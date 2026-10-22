import { describe, expect, it, vi } from 'vitest'
import { updateCatalogProduct } from '../src/lib/catalog-update.server'
import type { Actor } from '../src/lib/session.server'
const actor: Actor = { userId: '11111111-1111-4111-8111-111111111111', organizationId: '22222222-2222-4222-8222-222222222222', branchId: null, roles: [], orgRole: 'manager', correlationId: 'test-correlation', ip: null, userAgent: null }
const id = '33333333-3333-4333-8333-333333333333'
describe('shared catalog transaction service', () => {
  it('uses one RPC with authenticated actor context and the caller retry key/revision', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id, correlationId: 'saved-correlation', revision: '8' }, error: null })
    expect(await updateCatalogProduct({ rpc }, actor, { id, patch: { name_ar: 'اسم جديد', description_ar: null }, idempotencyKey: 'stable-command', expectedRevision: '7' })).toEqual({ id, correlationId: 'saved-correlation', revision: '8' })
    expect(rpc).toHaveBeenCalledExactlyOnceWith('catalog_update_product_atomic', { p_actor: actor.userId, p_org: actor.organizationId, p_product: id, p_key: 'stable-command', p_patch: { name_ar: 'اسم جديد', description_ar: null }, p_expected_revision: '7', p_correlation: 'test-correlation' })
  })
  it('does not retry via a non-atomic fallback after an RPC failure', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'PRODUCT_REVISION_CONFLICT' } })
    await expect(updateCatalogProduct({ rpc }, actor, { id, patch: { name_ar: 'اسم' } })).rejects.toThrow('PRODUCT_REVISION_CONFLICT')
    expect(rpc).toHaveBeenCalledTimes(1)
  })
  it('rejects an empty patch before calling the database', async () => {
    const rpc = vi.fn()
    await expect(updateCatalogProduct({ rpc }, actor, { id, patch: {} })).rejects.toThrow('EMPTY_PRODUCT_PATCH')
    expect(rpc).not.toHaveBeenCalled()
  })
  it('requires confirmation for the requested product and valid revision', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: actor.userId, correlationId: 'wrong-product', revision: '1' }, error: null })
    await expect(updateCatalogProduct({ rpc }, actor, { id, patch: { name_ar: 'اسم' } })).rejects.toThrow('PRODUCT_UPDATE_UNCONFIRMED')
  })
})
