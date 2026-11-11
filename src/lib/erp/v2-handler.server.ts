import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ERP_V2_IDEMPOTENCY_KEY,
  ERP_V2_UUID,
  erpV2Sha256,
  verifyErpV2,
  type ErpV2SignedFields,
} from './v2-signature'

export type ErpV2Result = { status: number; body: unknown }
export type ErpV2Run = (body: unknown, db: SupabaseClient, organizationId: string) => Promise<ErpV2Result>

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function safeParse(text: string): unknown {
  try { return JSON.parse(text) } catch { return undefined }
}

/**
 * ERP v2 is opt-in, and scoped to exactly ONE approved organization per
 * configured deployment. Never load server credentials from client env.
 * Do not activate without the matching reviewed, org-scoped SQL migration.
 */
export async function erpV2Handle(request: Request, path: string, run: ErpV2Run): Promise<Response> {
  if (process.env['ERP_SYNC_V2_ENABLED'] !== 'true') return json(503, { error: 'erp_v2_disabled' })

  const secret = process.env['ERP_SYNC_V2_HMAC_SECRET'] ?? ''
  const orgId = process.env['ERP_SYNC_V2_ORG_ID'] ?? ''
  if (secret.length < 32 || !ERP_V2_UUID.test(orgId)) {
    return json(503, { error: 'erp_v2_configuration_incomplete' })
  }
  let url: URL
  try { url = new URL(request.url) } catch { return json(400, { error: 'invalid_url' }) }
  if (url.pathname !== path) return json(404, { error: 'route_mismatch' })
  if (request.method !== 'GET' && request.method !== 'POST') return json(405, { error: 'method_not_allowed' })
  if (request.method === 'POST' && url.search) return json(400, { error: 'unexpected_query' })

  const sentOrgId = request.headers.get('x-erp-organization-id') ?? ''
  if (sentOrgId.toLowerCase() !== orgId.toLowerCase()) return json(403, { error: 'organization_mismatch' })

  const key = request.headers.get('idempotency-key') ?? ''
  if (request.method === 'POST' && !ERP_V2_IDEMPOTENCY_KEY.test(key)) {
    return json(400, { error: 'invalid_idempotency_key' })
  }
  if (request.method === 'GET' && key) return json(400, { error: 'unexpected_idempotency_key' })

  const body = request.method === 'GET' ? '' : await request.text()
  if (Buffer.byteLength(body, 'utf8') > 1_000_000) return json(413, { error: 'payload_too_large' })

  const fields: ErpV2SignedFields = {
    timestamp: request.headers.get('x-erp-timestamp') ?? '',
    method: request.method,
    target: url.pathname + url.search,
    organizationId: sentOrgId,
    idempotencyKey: key,
    body,
  }
  if (!verifyErpV2(secret, fields, request.headers.get('x-erp-signature') ?? '')) {
    return json(401, { error: 'invalid_signature_or_timestamp' })
  }
  const payload = body ? safeParse(body) : null
  if (body && payload === undefined) return json(400, { error: 'invalid_json' })

  let db: SupabaseClient
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    db = supabaseAdmin as SupabaseClient
  } catch {
    return json(503, { error: 'erp_v2_database_unavailable' })
  }

  if (request.method === 'GET') {
    try {
      const output = await run(null, db, orgId)
      return json(output.status, output.body)
    } catch {
      return json(503, { error: 'erp_v2_read_failed' })
    }
  }

  const { data: claim, error: claimError } = await db.rpc('erp2_claim_idempotency', {
    p_org_id: orgId,
    p_key: key,
    p_hash: erpV2Sha256(body),
    p_endpoint: path,
  })
  if (claimError || !claim || typeof claim !== 'object') {
    return json(503, { error: 'erp_v2_idempotency_unavailable' })
  }
  const state = (claim as { state?: string; response?: { status?: number; body?: unknown } }).state
  if (state === 'conflict') return json(409, { error: 'idempotency_conflict' })
  if (state === 'in_progress') return json(409, { error: 'idempotency_in_progress' })
  if (state === 'blocked') return json(409, { error: 'idempotency_requires_reconciliation' })
  if (state === 'replay') {
    const replay = (claim as { response?: { status?: number; body?: unknown } }).response
    if (!replay || typeof replay.status !== 'number' || replay.status < 200 || replay.status >= 500) {
      return json(503, { error: 'idempotency_replay_invalid' })
    }
    return json(replay.status, replay.body)
  }
  if (state !== 'new') return json(503, { error: 'unexpected_idempotency_state' })

  // The claim remains pending if business execution or finalization is uncertain.
  // We never delete a claim and blindly replay a possibly committed stock change.
  let result: ErpV2Result
  try {
    result = await run(payload, db, orgId)
  } catch {
    return json(503, { error: 'erp_v2_processing_uncertain' })
  }
  if (!Number.isInteger(result.status) || result.status < 200 || result.status >= 600) {
    return json(503, { error: 'erp_v2_invalid_result' })
  }

  // Keep 5xx outcomes pending for human reconciliation; an ambiguous write
  // must NEVER be automatically reissued under the same key.
  if (result.status >= 500) return json(result.status, result.body)

  const { error: finishError } = await db.rpc('erp2_finish_idempotency', {
    p_org_id: orgId,
    p_key: key,
    p_response: { status: result.status, body: result.body },
  })
  if (finishError) return json(503, { error: 'erp_v2_completion_uncertain' })
  return json(result.status, result.body)
}
