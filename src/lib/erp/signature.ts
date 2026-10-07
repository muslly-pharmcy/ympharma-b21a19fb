// Pure, runtime-agnostic helpers for the ERP integration contract (v1).
// Signature = HMAC-SHA256(secret, `${ts}.${METHOD}.${path}.${sha256hex(body)}`)
import { createHash, createHmac, timingSafeEqual } from 'crypto'

export const MAX_SKEW_SECONDS = 300

export const sha256Hex = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')

export function signRequest(secret: string, ts: string, method: string, path: string, body: string) {
  return createHmac('sha256', secret)
    .update(`${ts}.${method.toUpperCase()}.${path}.${sha256Hex(body)}`)
    .digest('hex')
}

export type VerifyResult = { ok: true } | { ok: false; reason: 'stale_timestamp' | 'bad_signature' }

export function verifyRequest(
  secret: string,
  headers: { ts: string; sig: string },
  method: string,
  path: string,
  body: string,
  nowSec = Date.now() / 1000,
): VerifyResult {
  const t = Number(headers.ts)
  if (!Number.isFinite(t) || Math.abs(nowSec - t) > MAX_SKEW_SECONDS) return { ok: false, reason: 'stale_timestamp' }
  const sig = headers.sig.toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(sig)) return { ok: false, reason: 'bad_signature' }
  const exp = signRequest(secret, headers.ts, method, path, body)
  return timingSafeEqual(Buffer.from(sig), Buffer.from(exp)) ? { ok: true } : { ok: false, reason: 'bad_signature' }
}

/** Convert a quantity between ERP pack units. Rejects unknown/mismatched units instead of guessing. */
export function toBaseUnits(qty: number, unit: string, map: { unit_code: string; units_per_pack: number }) {
  if (!Number.isFinite(qty) || qty < 0) throw new Error('invalid_qty')
  if (unit === map.unit_code) return qty * map.units_per_pack
  if (unit === 'UNIT') return qty
  throw new Error('unit_mismatch')
}
