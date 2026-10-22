import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ read: vi.fn(), insert: vi.fn(), select: vi.fn(), eq: vi.fn() }))
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: {
  from: () => ({ select: mocks.select, insert: mocks.insert }),
} }))
import { withIdempotency } from '@/lib/idempotency.server'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.select.mockReturnValue({ eq: mocks.eq })
  mocks.eq.mockReturnValue({ maybeSingle: mocks.read })
  mocks.read.mockResolvedValue({ data: null, error: null })
  mocks.insert.mockResolvedValue({ error: null })
})

describe('legacy receipt read authorization', () => {
  it.each([
    { actor_id: 'another-actor', command: 'receiveStock' },
    { actor_id: 'actor', command: 'redeemPoints' },
    { actor_id: null, command: 'receiveStock' },
  ])('denies a key collision without disclosing or executing: %j', async scope => {
    mocks.read.mockResolvedValue({ data: { ...scope, response: { privateRecord: 'foreign' } }, error: null })
    const mutate = vi.fn()
    await expect(withIdempotency('shared-key', 'actor', 'receiveStock', mutate)).rejects.toThrow('Idempotency key conflicts')
    expect(mutate).not.toHaveBeenCalled()
    expect(mocks.insert).not.toHaveBeenCalled()
  })
  it('fails closed when receipt lookup is unavailable', async () => {
    mocks.read.mockResolvedValue({ data: null, error: { message: 'database unavailable' } })
    const mutate = vi.fn()
    await expect(withIdempotency('key', 'actor', 'receiveStock', mutate)).rejects.toThrow('Unable to verify')
    expect(mutate).not.toHaveBeenCalled()
  })
  it.each([null, false, 0, '', { id: 'owned' }])('replays a stored result even when falsy: %j', async response => {
    mocks.read.mockResolvedValue({ data: { actor_id: 'actor', command: 'receiveStock', response }, error: null })
    const mutate = vi.fn()
    await expect(withIdempotency('key', 'actor', 'receiveStock', mutate)).resolves.toEqual(response)
    expect(mutate).not.toHaveBeenCalled()
  })
  it('retains creation behavior for an unused key', async () => {
    const mutate = vi.fn().mockResolvedValue({ id: 'new' })
    await expect(withIdempotency('key', 'actor', 'receiveStock', mutate)).resolves.toEqual({ id: 'new' })
    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mocks.insert).toHaveBeenCalledWith({ key: 'key', actor_id: 'actor', command: 'receiveStock', response: { id: 'new' } })
  })
})
