// Single source of truth for inbound WhatsApp webhook handling.
// Both /api/whatsapp-webhook (legacy path) and /api/public/hooks/whatsapp
// delegate here so the security contract cannot drift between them.
import { createHmac, timingSafeEqual } from 'node:crypto'

export interface WhatsAppChange {
  field?: string
  value?: {
    messages?: Array<{ id?: string; from?: string; type?: string; timestamp?: string }>
    statuses?: Array<{ id?: string; status?: string; timestamp?: string; recipient_id?: string }>
    metadata?: { phone_number_id?: string; display_phone_number?: string }
  }
}
export interface WhatsAppEntry {
  id?: string
  changes?: WhatsAppChange[]
}
export interface WhatsAppEnvelope {
  object?: string
  entry?: WhatsAppEntry[]
}

/** Constant-time comparison of two UTF-8 strings. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length === 0 || ba.length !== bb.length) return false
  try {
    return timingSafeEqual(ba, bb)
  } catch {
    return false
  }
}

/** Verify Meta's `x-hub-signature-256` header against the exact raw body bytes. */
export function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header || !header.startsWith('sha256=')) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const a = Buffer.from(header.slice('sha256='.length), 'hex')
  const b = Buffer.from(expected, 'hex')
  if (a.length === 0 || a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/** Meta GET verification handshake. Returns the Response to send. */
export function handleVerification(request: Request): Response {
  const url = new URL(request.url)
  const expected = process.env['WHATSAPP_VERIFY_TOKEN'] ?? ''
  if (!expected) return new Response('not configured', { status: 500 })
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')
  if (mode === 'subscribe' && token && challenge && safeEqual(token, expected)) {
    return new Response(challenge, { status: 200, headers: { 'content-type': 'text/plain' } })
  }
  return new Response('forbidden', { status: 403 })
}

/** Flatten an envelope into idempotent `whatsapp_events` rows. */
export function toEventRows(
  envelope: WhatsAppEnvelope,
  correlationId: string,
): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = []
  for (const entry of envelope.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value
      if (!value) continue
      const meta = value.metadata ?? {}
      for (const m of value.messages ?? []) {
        if (!m.id) continue
        rows.push({
          message_id: m.id,
          event_type: 'message',
          direction: 'inbound',
          from_number: m.from ?? null,
          phone_number_id: meta.phone_number_id ?? null,
          payload: change as unknown,
          correlation_id: correlationId,
        })
      }
      for (const s of value.statuses ?? []) {
        if (!s.id) continue
        rows.push({
          message_id: `${s.id}:${s.status ?? 'unknown'}`,
          event_type: 'status',
          direction: 'outbound',
          from_number: s.recipient_id ?? null,
          phone_number_id: meta.phone_number_id ?? null,
          payload: change as unknown,
          correlation_id: correlationId,
        })
      }
    }
  }
  return rows
}

export async function persistEvents(
  envelope: WhatsAppEnvelope,
  correlationId: string,
): Promise<{ inserted: number; duplicates: number }> {
  const rows = toEventRows(envelope, correlationId)
  if (rows.length === 0) return { inserted: 0, duplicates: 0 }
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    // `message_id` is UNIQUE → idempotency for Meta re-deliveries.
    const { data, error } = await supabaseAdmin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('whatsapp_events' as any)
      .upsert(rows, { onConflict: 'message_id', ignoreDuplicates: true })
      .select('id')
    if (error) {
      console.error('[whatsapp] persist error', { correlationId, error: error.message })
      return { inserted: 0, duplicates: rows.length }
    }
    const inserted = data?.length ?? 0
    return { inserted, duplicates: rows.length - inserted }
  } catch (e) {
    console.error('[whatsapp] persist threw', { correlationId, err: (e as Error).message })
    return { inserted: 0, duplicates: rows.length }
  }
}

// Tiny in-memory sliding window (per Worker instance). Meta call volume is low;
// this only sheds obvious floods before doing HMAC math.
const rlBuckets = new Map<string, number[]>()
export function rateLimit(key: string, windowMs = 60_000, max = 120): boolean {
  const now = Date.now()
  const arr = (rlBuckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (arr.length >= max) {
    rlBuckets.set(key, arr)
    return false
  }
  arr.push(now)
  rlBuckets.set(key, arr)
  return true
}

/**
 * Full POST pipeline: rate limit → HMAC verify → parse → persist.
 * Always returns 200 on success paths so Meta does not retry.
 */
export async function handleInboundPost(request: Request, correlationId: string): Promise<Response> {
  const secret = process.env['WHATSAPP_APP_SECRET'] ?? ''
  if (!secret) {
    console.error('[whatsapp] missing WHATSAPP_APP_SECRET', { correlationId })
    return new Response('ok', { status: 200 })
  }
  const ipKey =
    request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'unknown'
  if (!rateLimit(`whatsapp:${ipKey}`)) {
    return new Response('rate_limited', { status: 429, headers: { 'retry-after': '30' } })
  }
  // Read raw body BEFORE parsing — HMAC is over exact bytes.
  const raw = await request.text()
  if (!verifySignature(raw, request.headers.get('x-hub-signature-256'), secret)) {
    console.warn('[whatsapp] bad signature', { correlationId })
    return new Response('invalid signature', { status: 401 })
  }
  let envelope: WhatsAppEnvelope = {}
  try {
    envelope = JSON.parse(raw) as WhatsAppEnvelope
  } catch {
    console.warn('[whatsapp] bad json', { correlationId })
    return new Response('ok', { status: 200 })
  }
  const result = await persistEvents(envelope, correlationId)
  console.info('[whatsapp] processed', {
    correlationId,
    entries: envelope.entry?.length ?? 0,
    inserted: result.inserted,
    duplicates: result.duplicates,
  })
  return new Response('ok', { status: 200 })
}
