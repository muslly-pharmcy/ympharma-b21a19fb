// Supabase sink for structured errors.
// Writes to public.error_logs (RLS allows anon/authenticated inserts with
// size caps enforced server-side). Truncates all fields defensively.
// Non-blocking, best-effort — logging must never crash the app.
//
// Write-batching (ADR-0002): client buffers up to BATCH_MAX payloads or
// flushes every FLUSH_INTERVAL_MS, and force-flushes on `visibilitychange`
// (hidden) and `pagehide`. This collapses N single-row PostgREST inserts
// into one bulk insert, cutting per-row query planner + WAL overhead
// (the #3 slowest query in production, ~549 calls burning ~4.9s cumulative).

import { supabase } from '@/integrations/supabase/client'
import type { ErrorReport } from './logger'

const APP_VERSION =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_VERSION) ||
  'unknown'

const BATCH_MAX = 10
const FLUSH_INTERVAL_MS = 3000
const MAX_BUFFER = 50 // hard cap to prevent memory bloat during outages

function truncate(s: string | undefined | null, max: number): string | null {
  if (!s) return null
  return s.length > max ? s.slice(0, max) : s
}

function deviceInfo(): Record<string, unknown> {
  if (typeof navigator === 'undefined') return {}
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string; downlink?: number; rtt?: number }
    deviceMemory?: number
  }
  return {
    platform: nav.platform,
    language: nav.language,
    online: nav.onLine,
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
    screen:
      typeof window !== 'undefined' && window.screen
        ? { w: window.screen.width, h: window.screen.height, dpr: window.devicePixelRatio }
        : undefined,
    viewport:
      typeof window !== 'undefined'
        ? { w: window.innerWidth, h: window.innerHeight }
        : undefined,
    connection: nav.connection
      ? { effectiveType: nav.connection.effectiveType, downlink: nav.connection.downlink, rtt: nav.connection.rtt }
      : undefined,
    appVersion: APP_VERSION,
  }
}

// Dedupe identical errors within a short window to protect from loops.
const seen = new Map<string, number>()
const DEDUPE_MS = 10_000

function shouldSend(key: string): boolean {
  const now = Date.now()
  const prev = seen.get(key) ?? 0
  if (now - prev < DEDUPE_MS) return false
  seen.set(key, now)
  if (seen.size > 200) {
    for (const [k, t] of seen) if (now - t > DEDUPE_MS * 6) seen.delete(k)
  }
  return true
}

type ErrorRow = {
  level: 'error'
  source: string
  message: string
  stack: string | null
  url: string | null
  user_agent: string | null
  extra: Record<string, never>
  user_id?: string
}

let buffer: ErrorRow[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let listenersBound = false

async function flush(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (buffer.length === 0) return
  const rows = buffer
  buffer = []
  try {
    await supabase.from('error_logs').insert(rows)
  } catch {
    /* swallow — logging must never crash */
  }
}

function scheduleFlush(): void {
  if (flushTimer) return
  flushTimer = setTimeout(() => { void flush() }, FLUSH_INTERVAL_MS)
}

function bindLifecycleListeners(): void {
  if (listenersBound || typeof window === 'undefined') return
  listenersBound = true
  const forceFlush = () => { void flush() }
  window.addEventListener('pagehide', forceFlush)
  window.addEventListener('beforeunload', forceFlush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') forceFlush()
  })
}

async function buildPayload(report: ErrorReport): Promise<ErrorRow | null> {
  const key = `${report.kind}:${report.boundary}:${report.message}`
  if (!shouldSend(key)) return null

  const extra = {
    ...deviceInfo(),
    ...(report.extra ?? {}),
    correlationId: report.correlationId,
    kind: report.kind,
    status: report.status,
    timestamp: report.timestamp,
  }

  const { data: sess } = await supabase.auth.getUser()

  const payload: ErrorRow = {
    level: 'error',
    source: truncate(report.boundary, 100) ?? 'unknown',
    message: truncate(report.message, 2000) ?? 'unknown',
    stack: truncate(report.stack ?? null, 20000),
    url: truncate(report.route ?? null, 2000),
    user_agent: truncate(report.userAgent ?? null, 1000),
    extra: extra as unknown as Record<string, never>,
    ...(sess?.user?.id ? { user_id: sess.user.id } : {}),
  }

  const extraStr = JSON.stringify(payload.extra)
  if (extraStr.length > 7500) {
    payload.extra = {
      truncated: true,
      kind: report.kind,
      correlationId: report.correlationId,
    } as unknown as Record<string, never>
  }
  return payload
}

export async function sendReportToSupabase(report: ErrorReport): Promise<void> {
  try {
    const payload = await buildPayload(report)
    if (!payload) return
    bindLifecycleListeners()
    if (buffer.length >= MAX_BUFFER) {
      // Drop oldest to guarantee memory bound during backend outage.
      buffer.shift()
    }
    buffer.push(payload)
    if (buffer.length >= BATCH_MAX) {
      void flush()
    } else {
      scheduleFlush()
    }
  } catch {
    /* swallow — logging must never crash */
  }
}

// Exposed for tests / diagnostics.
export const __errorSinkInternals = {
  flush,
  getBufferSize: () => buffer.length,
}
