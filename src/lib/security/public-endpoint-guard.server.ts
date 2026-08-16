// Wave C.7 · R0.2 — Shared guard for /api/public/* endpoints.
//
// One reusable primitive so every public POST route enforces the same
// contract: method allowlist, content-type allowlist, body-size cap,
// per-IP sliding-window rate limit, correlation id, structured log.
//
// Design notes:
// - In-memory rate-limit store. Sufficient for a single Worker instance
//   under current traffic; documented limitation is acceptable for the
//   public surface (only csp-report today). A shared Redis / KV backend
//   is tracked as a follow-up in the release gate, not part of R0.2.
// - IP is SHA-256 hashed before use so we never log raw client IPs.
// - Guard returns either an accepted context or a fully-formed Response.
//   Handlers do not need to think about which failure mode fired.

import { newCorrelationId } from '@/lib/errors/correlation'

export interface PublicGuardOptions {
  /** Route identifier used to scope the rate-limit bucket. Required. */
  route: string
  /** Allowed HTTP methods. Defaults to ['POST']. */
  methods?: string[]
  /** Max request body size in bytes. Default 16 KB. */
  maxBytes?: number
  /**
   * Allowed request content-types (prefix match). Default: JSON + CSP report.
   * Pass an empty array to skip content-type enforcement.
   */
  contentTypes?: string[]
  /** Sliding-window rate limit. Default: 30 req / 60s / ip-hash. */
  rateLimit?: { windowMs: number; max: number }
}

export interface PublicGuardContext {
  correlationId: string
  ipHash: string
  body: string
  contentType: string
}

interface RateBucket {
  timestamps: number[]
}

const buckets = new Map<string, RateBucket>()

const DEFAULT_CONTENT_TYPES = [
  'application/json',
  'application/csp-report',
  'application/reports+json',
]

function pickIp(request: Request): string {
  const h = request.headers
  const cf = h.get('cf-connecting-ip')
  if (cf) return cf
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  const xr = h.get('x-real-ip')
  if (xr) return xr
  return 'unknown'
}

async function hashIp(ip: string): Promise<string> {
  const g = globalThis as { crypto?: { subtle?: SubtleCrypto } }
  if (!g.crypto?.subtle) return `plain:${ip.slice(0, 12)}`
  const bytes = new TextEncoder().encode(`muslly:${ip}`)
  const digest = await g.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function checkRateLimit(
  key: string,
  windowMs: number,
  max: number,
): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now()
  const bucket = buckets.get(key) ?? { timestamps: [] }
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs)
  if (bucket.timestamps.length >= max) {
    const oldest = bucket.timestamps[0] ?? now
    return { ok: false, retryAfterMs: windowMs - (now - oldest) }
  }
  bucket.timestamps.push(now)
  buckets.set(key, bucket)
  return { ok: true }
}

function jsonError(
  status: number,
  code: string,
  correlationId: string,
  extra?: Record<string, unknown>,
  headers?: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({ error: code, correlationId, ...extra }),
    {
      status,
      headers: {
        'content-type': 'application/json',
        'x-correlation-id': correlationId,
        ...(headers ?? {}),
      },
    },
  )
}

/**
 * Enforces the shared public-endpoint contract. On acceptance returns a
 * context (correlation id, hashed ip, capped body, content-type). On
 * rejection returns a ready-to-send Response.
 *
 * Handlers MUST call this first and short-circuit on Response.
 */
export async function guardPublicRequest(
  request: Request,
  opts: PublicGuardOptions,
): Promise<PublicGuardContext | Response> {
  const correlationId = newCorrelationId('pub')
  const methods = opts.methods ?? ['POST']
  const maxBytes = opts.maxBytes ?? 16 * 1024
  const contentTypes = opts.contentTypes ?? DEFAULT_CONTENT_TYPES
  const rate = opts.rateLimit ?? { windowMs: 60_000, max: 30 }

  if (!methods.includes(request.method)) {
    return jsonError(405, 'method_not_allowed', correlationId, undefined, {
      allow: methods.join(', '),
    })
  }

  const contentType = (request.headers.get('content-type') ?? '').toLowerCase()
  if (contentTypes.length > 0) {
    const ok = contentTypes.some((allowed) => contentType.startsWith(allowed))
    if (!ok) return jsonError(415, 'unsupported_media_type', correlationId)
  }

  const declared = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > maxBytes) {
    return jsonError(413, 'payload_too_large', correlationId, { maxBytes })
  }

  const ip = pickIp(request)
  const ipHash = await hashIp(ip)
  const rlKey = `${opts.route}:${ipHash}`
  const rl = checkRateLimit(rlKey, rate.windowMs, rate.max)
  if (!rl.ok) {
    const retryAfter = Math.max(1, Math.ceil(rl.retryAfterMs / 1000))
    return jsonError(
      429,
      'rate_limited',
      correlationId,
      { retryAfterSeconds: retryAfter },
      { 'retry-after': String(retryAfter) },
    )
  }

  const text = await request.text()
  if (text.length > maxBytes) {
    return jsonError(413, 'payload_too_large', correlationId, { maxBytes })
  }

  // Structured admission log — never includes body or raw IP.
   
  console.info('[public-guard]', {
    route: opts.route,
    method: request.method,
    ipHash,
    correlationId,
    bytes: text.length,
  })

  return { correlationId, ipHash, body: text, contentType }
}

/** Test-only: clear the in-memory rate-limit buckets. */
export function __resetPublicGuardForTests(): void {
  buckets.clear()
}
