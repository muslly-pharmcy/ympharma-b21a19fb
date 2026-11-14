import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { erpHandle } from '@/lib/erp/handler.server'
import { signRequest } from '@/lib/erp/signature'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: { rpc },
}))

const PATH = '/api/public/erp/v1/stock'
const SECRET = 'test-key-only-not-for-production'
const priorEnabled = process.env['ERP_SYNC_ENABLED']
const priorSecret = process.env['ERP_SYNC_HMAC_SECRET']

function signedRequest(body = JSON.stringify({ sourceSystem: 'synthetic-fixture', rows: [] })) {
  const timestamp = String(Math.floor(Date.now() / 1000))
  return new Request('https://example.invalid' + PATH, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-erp-timestamp': timestamp,
      'x-erp-signature': signRequest(SECRET, timestamp, 'POST', PATH, body),
      'idempotency-key': 'synthetic-request-key-000001',
    },
    body,
  })
}

beforeEach(() => {
  rpc.mockReset()
  process.env['ERP_SYNC_ENABLED'] = 'true'
  process.env['ERP_SYNC_HMAC_SECRET'] = SECRET
})

afterEach(() => {
  if (priorEnabled === undefined) delete process.env['ERP_SYNC_ENABLED']
  else process.env['ERP_SYNC_ENABLED'] = priorEnabled
  if (priorSecret === undefined) delete process.env['ERP_SYNC_HMAC_SECRET']
  else process.env['ERP_SYNC_HMAC_SECRET'] = priorSecret
})

describe('ERP HMAC idempotency fail-closed behavior', () => {
  it('must not run a transaction for an unknown claim state', async () => {
    rpc.mockResolvedValueOnce({ data: { state: 'unexpected' }, error: null })
    const run = vi.fn(async () => ({ status: 200, body: { accepted: true } }))
    const response = await erpHandle(signedRequest(), PATH, run)
    expect(response.status).toBe(503)
    expect(run).not.toHaveBeenCalled()
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('must reject a missing database claim without processing the request', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null })
    const run = vi.fn(async () => ({ status: 200, body: { accepted: true } }))
    const response = await erpHandle(signedRequest(), PATH, run)
    expect(response.status).toBe(503)
    expect(run).not.toHaveBeenCalled()
  })

  it('must not return success if finalizing idempotency fails after a write', async () => {
    rpc.mockResolvedValueOnce({ data: { state: 'new' }, error: null })
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'synthetic datastore failure' } })
    const run = vi.fn(async () => ({ status: 200, body: { accepted: true } }))
    const response = await erpHandle(signedRequest(), PATH, run)
    expect(response.status).toBe(503)
    expect((await response.json()).error).toBe('idempotency_finalize_failed')
    expect(run).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledTimes(2)
  })

  it('preserves the claim for reconciliation if processing has an unknown outcome', async () => {
    rpc.mockResolvedValueOnce({ data: { state: 'new' }, error: null })
    const run = vi.fn(async (): Promise<{ status: number; body: unknown }> => {
      throw new Error('synthetic simulated interruption after commit')
    })
    const response = await erpHandle(signedRequest(), PATH, run)
    expect(response.status).toBe(500)
    expect((await response.json()).error).toBe('processing_failed')
    // A second RPC that clears the claim would make a duplicate committed sale possible.
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('still processes and finalizes an ordinary new transaction', async () => {
    rpc.mockResolvedValueOnce({ data: { state: 'new' }, error: null })
    rpc.mockResolvedValueOnce({ data: null, error: null })
    const run = vi.fn(async () => ({ status: 200, body: { accepted: true } }))
    const response = await erpHandle(signedRequest(), PATH, run)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ accepted: true })
    expect(run).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledTimes(2)
  })

  it('never repeats the side effect on an acknowledged replay', async () => {
    rpc.mockResolvedValueOnce({ data: { state: 'replay', response: { accepted: true } }, error: null })
    const run = vi.fn(async () => ({ status: 200, body: { accepted: false } }))
    const response = await erpHandle(signedRequest(), PATH, run)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ accepted: true, replayed: true })
    expect(run).not.toHaveBeenCalled()
  })
})
