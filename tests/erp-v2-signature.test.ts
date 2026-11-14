import { describe, expect, it } from 'vitest'
import { ERP_V2_UUID, signErpV2, verifyErpV2 } from '@/lib/erp/v2-signature'

const SECRET = 'integration-secret-must-live-only-on-server'
const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'
const NOW = 1800000000
const FIELDS = {
  timestamp: String(NOW),
  method: 'POST',
  target: '/api/public/erp/v2/stock',
  organizationId: ORG_A,
  idempotencyKey: 'tenant-A-invoice-0001',
  body: '{"rows":[{"external_item":"A1","qty_available":"3.0000"}]}',
}

describe('ERP v2 fail-closed transport identity', () => {
  const sig = signErpV2(SECRET, FIELDS)
  it('accepts exact signed fields and rejects stale timestamps', () => {
    expect(verifyErpV2(SECRET, FIELDS, sig, NOW)).toBe(true)
    expect(verifyErpV2(SECRET, FIELDS, sig, NOW + 301)).toBe(false)
  })
  it('denies replay to another organization', () => {
    expect(verifyErpV2(SECRET, { ...FIELDS, organizationId: ORG_B }, sig, NOW)).toBe(false)
  })
  it('denies a changed idempotency key with identical body', () => {
    expect(verifyErpV2(SECRET, { ...FIELDS, idempotencyKey: 'tenant-A-invoice-0002' }, sig, NOW)).toBe(false)
  })
  it('denies payload, path and method mutations', () => {
    expect(verifyErpV2(SECRET, { ...FIELDS, body: FIELDS.body + ' ' }, sig, NOW)).toBe(false)
    expect(verifyErpV2(SECRET, { ...FIELDS, target: '/api/public/erp/v2/orders/ack' }, sig, NOW)).toBe(false)
    expect(verifyErpV2(SECRET, { ...FIELDS, method: 'GET' }, sig, NOW)).toBe(false)
  })
  it('binds GET query filters and rejects extra idempotency fields', () => {
    const fields = { ...FIELDS, method: 'GET', idempotencyKey: '', body: '', target: '/api/public/erp/v2/orders/pending?limit=25' }
    const getSignature = signErpV2(SECRET, fields)
    expect(verifyErpV2(SECRET, fields, getSignature, NOW)).toBe(true)
    expect(verifyErpV2(SECRET, { ...fields, target: '/api/public/erp/v2/orders/pending?limit=500' }, getSignature, NOW)).toBe(false)
    expect(verifyErpV2(SECRET, { ...fields, idempotencyKey: FIELDS.idempotencyKey }, getSignature, NOW)).toBe(false)
  })
  it('requires UUID format and 16+ character idempotency key', () => {
    expect(ERP_V2_UUID.test(ORG_A)).toBe(true)
    expect(verifyErpV2(SECRET, { ...FIELDS, organizationId: 'unknown' }, sig, NOW)).toBe(false)
    const bad = { ...FIELDS, idempotencyKey: 'short' }
    expect(verifyErpV2(SECRET, bad, signErpV2(SECRET, bad), NOW)).toBe(false)
  })
})
