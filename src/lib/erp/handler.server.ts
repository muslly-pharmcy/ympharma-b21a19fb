import { canonicalTarget, sha256Hex, verifyRequest, type Identity } from './signature'
export type ErpContext = Identity & { contentHash: string; target: string }
export const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
export const ERP_ORDER_FLOW_ENABLED = false as const
export const ERP_CATALOG_FLOW_ENABLED = false as const
export async function erpHandle(request: Request, path: string, run: (body: unknown, db: any, context: ErpContext) => Promise<{ status: number; body: unknown }>, dependencies?: { env: Record<string, string | undefined>; db: any; nowSec?: number; localOrders?: boolean }) {
  const env = dependencies?.env ?? process.env
  if (env.ERP_SYNC_ENABLED !== 'true' || env.ERP_SYNC_CONTRACT_VERSION !== '2') return json(503, { error: 'erp_sync_disabled' })
  if (!env.ERP_SYNC_HMAC_SECRET || !env.ERP_SYNC_SOURCE_ID || !env.ERP_SYNC_KEY_ID) return json(503, { error: 'erp_identity_not_configured' })
  // Provisioning must bind the explicit reviewed deployment database, not a repository default.
  if (!dependencies) {
    const { getPublicSupabaseConfig } = await import('@/integrations/supabase/public-config')
    const actual = getPublicSupabaseConfig().url
    if (!env.ERP_SYNC_APPROVED_DATABASE_URL || actual !== env.ERP_SYNC_APPROVED_DATABASE_URL) return json(503, { error: 'erp_database_not_approved' })
  }
  const url = new URL(request.url), target = url.pathname + url.search
  try { if (url.pathname !== path || canonicalTarget(target) !== target) return json(400, { error: 'invalid_target' }) } catch { return json(400, { error: 'invalid_target' }) }
  const identity = { keyId: request.headers.get('x-erp-key-id') ?? '', source: request.headers.get('x-erp-source') ?? '', idempotencyKey: request.headers.get('idempotency-key') ?? '' }
  if (identity.keyId !== env.ERP_SYNC_KEY_ID || identity.source !== env.ERP_SYNC_SOURCE_ID || request.headers.get('x-erp-protocol') !== '2') return json(401, { error: 'identity_mismatch' })
  if (request.headers.has('content-encoding')) return json(415, { error: 'encoded_body_not_supported' })
  let bytes: Uint8Array
  try {
    const chunks: Uint8Array[] = []; let length = 0
    const reader = request.body?.getReader()
    if (reader) { for (;;) { const r = await reader.read(); if (r.done) break; length += r.value.length; if (length > 1000000) { await reader.cancel(); return json(413, { error: 'payload_too_large' }) } chunks.push(r.value) } }
    bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  } catch { return json(400, { error: 'incomplete_body' }) }
  const verified = verifyRequest(env.ERP_SYNC_HMAC_SECRET, { ts: request.headers.get('x-erp-timestamp') ?? '', sig: request.headers.get('x-erp-signature') ?? '' }, request.method, target, bytes, identity, dependencies?.nowSec)
  if (!verified.ok) return json(401, { error: verified.reason })
  // Fail closed until inbox, reservation ownership, expiry and release are integrated and accepted.
  if (path.includes('/orders/') && !ERP_ORDER_FLOW_ENABLED && !(dependencies?.localOrders && new URL(request.url).hostname === '127.0.0.1')) return json(503, { error: 'erp_order_flow_not_implemented' })
  if (path.includes('/catalog/') && !ERP_CATALOG_FLOW_ENABLED && !(dependencies?.localOrders && new URL(request.url).hostname === '127.0.0.1')) return json(503, { error: 'erp_catalog_flow_not_activated' })
  let body: unknown = null
  if (request.method === 'POST') {
    if (request.headers.get('content-type') !== 'application/json') return json(415, { error: 'json_required' })
    try { if (bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191) throw Error(); body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) } catch { return json(400, { error: 'invalid_json_utf8' }) }
    if (!body || typeof body !== 'object' || (body as any).sourceSystem !== identity.source) return json(403, { error: 'source_mismatch' })
  }
  if (path.endsWith('/stock') && body && typeof body === 'object' && 'projection' in body && !ERP_ORDER_FLOW_ENABLED && !(dependencies?.localOrders && url.hostname === '127.0.0.1')) return json(503, { error: 'erp_order_flow_not_implemented' })
  try {
    const db = dependencies?.db ?? (await import('@/integrations/supabase/client.server')).supabaseAdmin
    // Stock RPC owns idempotency, row outcomes and snapshot changes in ONE transaction.
    const result = await run(body, db, { ...identity, target, contentHash: sha256Hex(bytes) })
    return json(result.status, result.body)
  } catch { return json(503, { error: 'erp_processing_unconfirmed' }) }
}
