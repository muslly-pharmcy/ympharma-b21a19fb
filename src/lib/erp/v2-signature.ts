/**
 * Version 2 of the disabled-by-default ERP transport signature.
 * Binds the tenant, idempotency key, full request target (including query),
 * timestamp, method, and exact bytes of the body.
 * Do NOT reuse the legacy v1 signature for this version.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const ERP_V2_MAX_SKEW_SECONDS = 300
export const ERP_V2_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const ERP_V2_IDEMPOTENCY_KEY = /^[a-zA-Z0-9_-]{16,128}$/

export type ErpV2SignedFields = {
  timestamp: string
  method: string
  target: string
  organizationId: string
  idempotencyKey: string
  body: string
}
export function erpV2Sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

export function signErpV2(secret: string, fields: ErpV2SignedFields): string {
  // JSON encoding prevents ambiguous delimiter collisions in attacker-controlled input.
  const message = JSON.stringify([
    'ympharma-erp-v2',
    fields.timestamp,
    fields.method.toUpperCase(),
    fields.target,
    fields.organizationId.toLowerCase(),
    fields.idempotencyKey,
    erpV2Sha256(fields.body),
  ])
  return createHmac('sha256', secret).update(message).digest('hex')
}

export function verifyErpV2(
  secret: string,
  fields: ErpV2SignedFields,
  signature: string,
  nowSeconds = Date.now() / 1000,
): boolean {
  const time = Number(fields.timestamp)
  if (!/^\d{10,13}$/.test(fields.timestamp) || !Number.isSafeInteger(time)) return false
  if (Math.abs(nowSeconds - time) > ERP_V2_MAX_SKEW_SECONDS) return false
  if (!ERP_V2_UUID.test(fields.organizationId)) return false
  if (!fields.target.startsWith('/api/public/erp/v2/')) return false
  if (!['GET', 'POST'].includes(fields.method.toUpperCase())) return false
  if (fields.method.toUpperCase() === 'GET' && (fields.body || fields.idempotencyKey)) return false
  if (fields.method.toUpperCase() === 'POST' && !ERP_V2_IDEMPOTENCY_KEY.test(fields.idempotencyKey)) return false
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false
  const expected = signErpV2(secret, fields)
  return timingSafeEqual(Buffer.from(signature.toLowerCase(), 'hex'), Buffer.from(expected, 'hex'))
}
