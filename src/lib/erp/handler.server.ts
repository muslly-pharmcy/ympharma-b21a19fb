import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { sha256Hex, verifyRequest } from './signature'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/**
 * Shared guard for /api/public/erp/v1/*: kill switch (default OFF), HMAC, idempotency
 * (same key + same hash → replay; same key + different hash → 409). Never logs payloads.
 */
export async function erpHandle(
  request: Request,
  path: string,
  run: (body: unknown, db: SupabaseClient) => Promise<{ status: number; body: unknown }>,
) {
  if (process.env['ERP_SYNC_ENABLED'] !== 'true') return json(503, { error: 'erp_sync_disabled' })
  const secret = process.env['ERP_SYNC_HMAC_SECRET']
  if (!secret) return json(503, { error: 'erp_secret_not_configured' })

  const body = request.method === 'GET' ? '' : await request.text()
  if (body.length > 1_000_000) return json(413, { error: 'payload_too_large' })
  const v = verifyRequest(
    secret,
    { ts: request.headers.get('x-erp-timestamp') ?? '', sig: request.headers.get('x-erp-signature') ?? '' },
    request.method,
    path,
    body,
  )
  if (!v.ok) return json(401, { error: v.reason })

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const db = supabaseAdmin as SupabaseClient
  const parsed = body ? safeJson(body) : null
  if (body && parsed === undefined) return json(400, { error: 'invalid_json' })

  if (request.method === 'GET') {
    const r = await run(parsed, db)
    return json(r.status, r.body)
  }

  const key = request.headers.get('idempotency-key') ?? ''
  if (!z.string().min(8).max(200).safeParse(key).success) return json(400, { error: 'missing_idempotency_key' })
  // Do not invoke a financial write unless the server has explicitly granted
  // a fresh idempotency claim. Missing/unknown RPC results are not "new".
  let claim: { state?: string; response?: unknown } | null = null
  try {
    const { data, error } = await db.rpc('erp_claim_idempotency', {
      p_key: key, p_hash: sha256Hex(body), p_endpoint: path,
    })
    if (error) return json(503, { error: 'idempotency_store_failed' })
    claim = data as { state?: string; response?: unknown } | null
  } catch {
    return json(503, { error: 'idempotency_store_failed' })
  }
  if (claim?.state === 'conflict') return json(409, { error: 'idempotency_key_reused_with_different_content' })
  if (claim?.state === 'replay') {
    if (!claim.response || typeof claim.response !== 'object' || Array.isArray(claim.response))
      return json(503, { error: 'idempotency_replay_unverifiable' })
    return json(200, { ...claim.response, replayed: true })
  }
  if (claim?.state === 'in_progress') return json(409, { error: 'request_in_progress', retryAfterSeconds: 5 })
  if (claim?.state !== 'new') return json(503, { error: 'idempotency_claim_unverifiable' })

  let outcome: { status: number; body: unknown }
  try {
    outcome = await run(parsed, db)
  } catch {
    // A remote write may have committed before the response was lost.
    // Preserve the processing claim for reconciliation rather than deleting
    // it and admitting a duplicate replay with the same key.
    return json(500, { error: 'processing_failed', reconciliationRequired: true })
  }
  if (!Number.isInteger(outcome.status) || outcome.status < 200 || outcome.status > 599)
    return json(503, { error: 'processing_result_unverifiable', reconciliationRequired: true })
  if (outcome.status >= 500) {
    // The remote commit state is unknown; do not mark the key available again.
    return json(outcome.status, outcome.body)
  }

  try {
    const { error } = await db.rpc('erp_finish_idempotency', {
      p_key: key, p_response: outcome.body, p_ok: true,
    })
    if (error) return json(503, { error: 'idempotency_finalize_failed', reconciliationRequired: true })
  } catch {
    return json(503, { error: 'idempotency_finalize_failed', reconciliationRequired: true })
  }
  return json(outcome.status, outcome.body)
}

function safeJson(s: string): unknown {
  try { return JSON.parse(s) } catch { return undefined }
}
