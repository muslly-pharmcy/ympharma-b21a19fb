import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { erpV2Handle } from '@/lib/erp/v2-handler.server'
import { signErpV2 } from '@/lib/erp/v2-signature'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}))
vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: { rpc: mocks.rpc },
}))

const orgId = '11111111-1111-4111-8111-111111111111'
const key = 'replay-safe-key-0001'
const secret = 'development-fixture-secret-32-characters-minimum'
const path = '/api/public/erp/v2/stock'
const saved = {
  enabled: process.env['ERP_SYNC_V2_ENABLED'],
  org: process.env['ERP_SYNC_V2_ORG_ID'],
  secret: process.env['ERP_SYNC_V2_HMAC_SECRET'],
}

function request(body = '{"sourceSystem":"fixture","rows":[]}'): Request {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const signature = signErpV2(secret, {
    timestamp, method: 'POST', target: path, organizationId: orgId,
    idempotencyKey: key, body,
  })
  return new Request('https://local.test' + path, {
    method: 'POST',
    body,
    headers: {
      'x-erp-timestamp': timestamp,
      'x-erp-organization-id': orgId,
      'x-erp-signature': signature,
      'idempotency-key': key,
    },
  })
}

beforeEach(() => {
  process.env['ERP_SYNC_V2_ENABLED'] = 'true'
  process.env['ERP_SYNC_V2_ORG_ID'] = orgId
  process.env['ERP_SYNC_V2_HMAC_SECRET'] = secret
  mocks.rpc.mockReset()
})
afterEach(() => {
  for (const [name, original] of [
    ['ERP_SYNC_V2_ENABLED', saved.enabled],
    ['ERP_SYNC_V2_ORG_ID', saved.org],
    ['ERP_SYNC_V2_HMAC_SECRET', saved.secret],
  ] as const) {
    if (original === undefined) delete process.env[name]
    else process.env[name] = original
  }
})

describe('ERP v2 uncertain-write and idempotency handler', () => {
  it('returns a successful business result only after idempotency completion is saved', async () => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === 'erp2_claim_idempotency') return { data: { state: 'new' }, error: null }
      if (name === 'erp2_finish_idempotency') return { data: null, error: null }
      throw new Error('Unexpected RPC')
    })
    const run = vi.fn(async () => ({ status: 200, body: { applied: 1 } }))
    const response = await erpV2Handle(request(), path, run)
    expect(response.status).toBe(200)
    expect(run).toHaveBeenCalledExactlyOnceWith(expect.anything(), expect.anything(), orgId)
    expect(mocks.rpc).toHaveBeenCalledTimes(2)
    expect(mocks.rpc).toHaveBeenCalledWith(
      'erp2_finish_idempotency',
      expect.objectContaining({ p_org_id: orgId, p_key: key }),
    )
  })
  it('replays only the stored result without a second stock change', async () => {
    mocks.rpc.mockResolvedValue({ data: { state: 'replay', response: { status: 200, body: { applied: 1 } } }, error: null })
    const run = vi.fn()
    const response = await erpV2Handle(request(), path, run)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ applied: 1 })
    expect(run).not.toHaveBeenCalled()
  })
  it('returns conflict for reused key with different payload', async () => {
    mocks.rpc.mockResolvedValue({ data: { state: 'conflict' }, error: null })
    const run = vi.fn()
    const response = await erpV2Handle(request(), path, run)
    expect(response.status).toBe(409)
    expect(run).not.toHaveBeenCalled()
  })
  it('keeps a processing claim blocked rather than replaying ambiguous writes', async () => {
    mocks.rpc.mockResolvedValue({ data: { state: 'in_progress' }, error: null })
    const run = vi.fn()
    const response = await erpV2Handle(request(), path, run)
    expect(response.status).toBe(409)
    expect(run).not.toHaveBeenCalled()
  })
  it('never reports success if recording the outcome fails', async () => {
    mocks.rpc.mockImplementation(async (name: string) => (
      name === 'erp2_claim_idempotency'
        ? { data: { state: 'new' }, error: null }
        : { data: null, error: { code: '08006' } }
    ))
    const response = await erpV2Handle(request(), path, async () => ({ status: 200, body: { applied: 1 } }))
    expect(response.status).toBe(503)
  })
  it('handles a network exception during idempotency claim without invoking stock code', async () => {
    mocks.rpc.mockRejectedValue(new Error('network unavailable'))
    const run = vi.fn()
    const response = await erpV2Handle(request(), path, run)
    expect(response.status).toBe(503)
    expect(run).not.toHaveBeenCalled()
  })
  it('keeps unknown execution outcome pending (does not finalize)', async () => {
    mocks.rpc.mockResolvedValue({ data: { state: 'new' }, error: null })
    const response = await erpV2Handle(request(), path, async () => { throw new Error('timeout') })
    expect(response.status).toBe(503)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })
  it('rejects oversized body before HMAC or database access', async () => {
    const response = await erpV2Handle(request('x'.repeat(1_000_001)), path, vi.fn())
    expect(response.status).toBe(413)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
