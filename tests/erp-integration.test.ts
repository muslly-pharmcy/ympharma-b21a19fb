import { describe, expect, it } from 'vitest'
import { sha256Hex, signRequest, toBaseUnits, verifyRequest } from '@/lib/erp/signature'

const S = 'test-secret-synthetic'
const P = '/api/public/erp/v1/stock'
const now = 1_800_000_000

describe('ERP signature', () => {
  const body = JSON.stringify({ rows: [{ erp_item_id: 'X1', qty_available: 3 }] })
  const ts = String(now)
  const sig = signRequest(S, ts, 'POST', P, body)

  it('accepts a valid signature', () => {
    expect(verifyRequest(S, { ts, sig }, 'POST', P, body, now)).toEqual({ ok: true })
  })
  it('rejects tampered body', () => {
    expect(verifyRequest(S, { ts, sig }, 'POST', P, body + ' ', now).ok).toBe(false)
  })
  it('rejects a different path (no cross-endpoint replay)', () => {
    expect(verifyRequest(S, { ts, sig }, 'POST', '/api/public/erp/v1/orders/ack', body, now).ok).toBe(false)
  })
  it('rejects stale timestamps', () => {
    expect(verifyRequest(S, { ts, sig }, 'POST', P, body, now + 301)).toEqual({ ok: false, reason: 'stale_timestamp' })
  })
  it('rejects wrong secret', () => {
    expect(verifyRequest('other', { ts, sig }, 'POST', P, body, now).ok).toBe(false)
  })
  it('content hash differs for different content under same key', () => {
    expect(sha256Hex('{"a":1}')).not.toBe(sha256Hex('{"a":2}'))
  })
})

describe('ERP unit conversion', () => {
  const map = { unit_code: 'BOX', units_per_pack: 10 }
  it('converts packs to base units', () => expect(toBaseUnits(2, 'BOX', map)).toBe(20))
  it('keeps base units', () => expect(toBaseUnits(7, 'UNIT', map)).toBe(7))
  it('rejects unknown units instead of guessing', () => expect(() => toBaseUnits(1, 'STRIP', map)).toThrow('unit_mismatch'))
  it('rejects negative quantities', () => expect(() => toBaseUnits(-1, 'BOX', map)).toThrow('invalid_qty'))
})
