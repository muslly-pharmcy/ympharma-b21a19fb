// Protocol 2. Routes remain under /erp/v1 to preserve the existing router surface.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
export const MAX_SKEW_SECONDS = 300
export const PROTOCOL = 'ERP-MUSLLY/2'
export type Identity = { keyId: string; source: string; idempotencyKey: string }
const token = /^[A-Za-z0-9_-]{1,120}$/
const encode = (v: string) => encodeURIComponent(v).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
export function canonicalTarget(target: string) {
  const [path, query, ...extra] = target.split('?')
  if (extra.length || !/^\/api\/public\/erp\/v1\/(stock|orders\/pending|orders\/ack|reconcile|catalog\/(apply|preview))$/.test(path)) throw Error('invalid_target')
  const params = new URLSearchParams(query ?? '')
  const keys = [...params.keys()]
  if (new Set(keys).size !== keys.length || keys.some(k => !['cursor', 'limit'].includes(k)) || ((path.endsWith('/stock') || path.endsWith('/ack') || path.endsWith('/apply') || path.endsWith('/preview')) && keys.length)) throw Error('invalid_query')
  const normalized = keys.sort().map(k => `${encode(k)}=${encode(params.get(k)!)}`).join('&')
  const result = path + (normalized ? '?' + normalized : '')
  if (result !== target) throw Error('noncanonical_target')
  return result
}
export const sha256Hex = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex')
export function canonicalMessage(ts: string, method: string, target: string, bytes: Uint8Array, identity: Identity) {
  if (!/^(0|[1-9][0-9]{0,10})$/.test(ts) || !['GET', 'POST'].includes(method) || !token.test(identity.keyId) || !token.test(identity.source)) throw Error('invalid_identity')
  if (method === 'POST' ? !/^[A-Za-z0-9_-]{8,200}$/.test(identity.idempotencyKey) : identity.idempotencyKey !== '' || bytes.length !== 0) throw Error('invalid_request')
  return [PROTOCOL, identity.keyId, identity.source, ts, method, canonicalTarget(target), identity.idempotencyKey, sha256Hex(bytes)].join('\n')
}
export function signRequest(secret: string, ts: string, method: string, target: string, bytes: Uint8Array, identity: Identity) {
  return createHmac('sha256', secret).update(canonicalMessage(ts, method, target, bytes, identity), 'utf8').digest('hex')
}
export function verifyRequest(secret: string, headers: { ts: string; sig: string }, method: string, target: string, bytes: Uint8Array, identity: Identity, nowSec = Date.now() / 1000) {
  if (!/^(0|[1-9][0-9]{0,10})$/.test(headers.ts) || Math.abs(nowSec - Number(headers.ts)) > MAX_SKEW_SECONDS) return { ok: false, reason: 'stale_timestamp' } as const
  if (!/^[a-f0-9]{64}$/.test(headers.sig)) return { ok: false, reason: 'bad_signature' } as const
  try {
    const expected = signRequest(secret, headers.ts, method, target, bytes, identity)
    return timingSafeEqual(Buffer.from(headers.sig, 'hex'), Buffer.from(expected, 'hex')) ? { ok: true } as const : { ok: false, reason: 'bad_signature' } as const
  } catch { return { ok: false, reason: 'invalid_canonical_request' } as const }
}
/** No implicit UNIT alias. Mapping must explicitly verify this exact UOM. */
export function toBaseUnits(qty: string, unit: string, map: { unit_code: string; units_per_pack: string; verified: boolean }) {
  if (!map.verified || unit !== map.unit_code) throw Error('unit_mismatch')
  if (!/^(0|[1-9][0-9]{0,14})(\.[0-9]{1,6})?$/.test(qty) || !/^[1-9][0-9]{0,6}$/.test(map.units_per_pack) || BigInt(map.units_per_pack) > 1000000n) throw Error('invalid_qty')
  const [whole, fraction = ''] = qty.split('.'), scale = 10n ** BigInt(fraction.length)
  const base = BigInt(whole + fraction) * BigInt(map.units_per_pack)
  if (base % scale) throw Error('fractional_base_unit')
  return (base / scale).toString()
}
