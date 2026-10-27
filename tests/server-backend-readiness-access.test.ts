import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getActor: vi.fn(), requirePermission: vi.fn(), inspect: vi.fn(), createClient: vi.fn(),
}))
vi.mock('@/lib/session.server', () => ({ getActor: mocks.getActor, requirePermission: mocks.requirePermission }))
vi.mock('@/lib/backend/server-credentials.server', () => ({ inspectServerBackend: mocks.inspect }))
vi.mock('@/lib/backend/admin.server', () => ({ createSelectedAdminClient: mocks.createClient }))

import { readServerBackendReadiness as runCheck } from '@/lib/backend/readiness.server'

beforeEach(() => vi.resetAllMocks())

describe('server backend readiness authorization', () => {
  it('rejects an invalid session before touching credentials or storage', async () => {
    mocks.getActor.mockRejectedValue(new Error('Invalid session'))
    await expect(runCheck()).rejects.toThrow('Invalid session')
    expect(mocks.requirePermission).not.toHaveBeenCalled()
    expect(mocks.inspect).not.toHaveBeenCalled()
    expect(mocks.createClient).not.toHaveBeenCalled()
  })
  it('checks system.admin on the server before any secret-dependent operation', async () => {
    const actor = { orgRole: 'viewer', roles: [] }
    mocks.getActor.mockResolvedValue(actor)
    mocks.requirePermission.mockImplementation(() => { throw new Error('Forbidden') })
    await expect(runCheck()).rejects.toThrow('Forbidden')
    expect(mocks.requirePermission).toHaveBeenCalledExactlyOnceWith(actor, 'system.admin')
    expect(mocks.inspect).not.toHaveBeenCalled()
    expect(mocks.createClient).not.toHaveBeenCalled()
  })
  it('performs only the redacted readiness probe for an authorized owner', async () => {
    const actor = { orgRole: 'owner', roles: [] }
    const safeResult = { connection: 'verified', productImages: 'private' }
    const listBuckets = vi.fn().mockResolvedValue({ data: [], error: null })
    mocks.getActor.mockResolvedValue(actor)
    mocks.createClient.mockReturnValue({ storage: { listBuckets } })
    mocks.inspect.mockImplementation(async (_env, probe) => {
      await probe('sb_secret_synthetic_only')
      return safeResult
    })
    await expect(runCheck()).resolves.toBe(safeResult)
    expect(mocks.requirePermission).toHaveBeenCalledExactlyOnceWith(actor, 'system.admin')
    expect(mocks.createClient).toHaveBeenCalledExactlyOnceWith('sb_secret_synthetic_only', 5000)
    expect(listBuckets).toHaveBeenCalledOnce()
  })
})
