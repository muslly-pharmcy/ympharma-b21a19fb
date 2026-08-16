// Unified AI observability — one write path for every AI call in the app.
//
// Phase 1 (Stabilize): each provider call site records a single row so the
// Control Tower can answer "is the AI healthy, which feature is failing, and
// why" without opening the code. Reuses the existing `kernel_module_telemetry`
// table (module_key = 'kernel', meta.kind = 'ai_call') — no duplicate infra.

import type { AiErrorClass } from './error-classify'

export interface AiCallRecord {
  /** Product surface making the call, e.g. 'patient-chat', 'vision-rx', 'social'. */
  feature: string
  model: string
  /** 'openai' | 'gateway' | any provider label the call site uses. */
  backend?: string
  ok: boolean
  latencyMs?: number
  errorClass?: AiErrorClass
  tokensIn?: number
  tokensOut?: number
  toolCalls?: number
  correlationId?: string
}

/** Never throws — observability must not break a working feature. */
export async function recordAiCall(record: AiCallRecord): Promise<void> {
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    await supabaseAdmin.from('kernel_module_telemetry').insert({
      module_key: 'kernel',
      status: record.ok ? 'healthy' : 'degraded',
      latency_ms: record.latencyMs ?? null,
      error_rate: record.ok ? 0 : 1,
      budget_used: (record.tokensIn ?? 0) + (record.tokensOut ?? 0),
      runs: 1,
      failures: record.ok ? 0 : 1,
      meta: {
        kind: 'ai_call',
        feature: record.feature,
        model: record.model,
        backend: record.backend ?? null,
        error_class: record.errorClass ?? null,
        tokens_in: record.tokensIn ?? 0,
        tokens_out: record.tokensOut ?? 0,
        tool_calls: record.toolCalls ?? 0,
        correlation_id: record.correlationId ?? null,
      } as never,
    })
  } catch (e) {
    console.warn('[ai-observability] skipped', (e as Error).message)
  }
}

/** Wrap any AI call so success, latency and error class are always recorded. */
export async function withAiTelemetry<T>(
  meta: { feature: string; model: string; backend?: string; correlationId?: string },
  fn: () => Promise<T>,
): Promise<T> {
  const started = Date.now()
  try {
    const out = await fn()
    void recordAiCall({ ...meta, ok: true, latencyMs: Date.now() - started })
    return out
  } catch (err) {
    const { classifyThrownAi } = await import('./error-classify')
    void recordAiCall({
      ...meta,
      ok: false,
      latencyMs: Date.now() - started,
      errorClass: classifyThrownAi(err),
    })
    throw err
  }
}

export interface AiFeatureHealth {
  feature: string
  calls: number
  failures: number
  errorRate: number
  avgLatencyMs: number
  tokens: number
  topErrorClass: string | null
  lastSeen: string | null
  status: 'healthy' | 'degraded' | 'critical' | 'idle'
}

export interface AiHealthSummary {
  windowHours: number
  totals: { calls: number; failures: number; errorRate: number; tokens: number; avgLatencyMs: number }
  byFeature: AiFeatureHealth[]
  byErrorClass: { errorClass: string; count: number }[]
  byModel: { model: string; calls: number; failures: number }[]
  providers: { openaiKeyConfigured: boolean; gatewayKeyConfigured: boolean }
}

function statusFor(calls: number, errorRate: number): AiFeatureHealth['status'] {
  if (calls === 0) return 'idle'
  if (errorRate >= 0.5) return 'critical'
  if (errorRate > 0.1) return 'degraded'
  return 'healthy'
}

/** Read-only aggregation for the Control Tower AI health panel. */
export async function aiHealthSummary(hours = 24): Promise<AiHealthSummary> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const since = new Date(Date.now() - hours * 3600_000).toISOString()

  const { data } = await supabaseAdmin
    .from('kernel_module_telemetry')
    .select('latency_ms, runs, failures, budget_used, observed_at, meta')
    .eq('module_key', 'kernel')
    .gte('observed_at', since)
    .order('observed_at', { ascending: false })
    .limit(5000)

  const features = new Map<
    string,
    { calls: number; failures: number; latency: number; latencyN: number; tokens: number; last: string | null; errs: Map<string, number> }
  >()
  const errorClasses = new Map<string, number>()
  const models = new Map<string, { calls: number; failures: number }>()

  let calls = 0
  let failures = 0
  let tokens = 0
  let latency = 0
  let latencyN = 0

  for (const row of data ?? []) {
    const meta = (row.meta ?? {}) as Record<string, unknown>
    if (meta['kind'] !== 'ai_call') continue

    const feature = String(meta['feature'] ?? 'unknown')
    const model = String(meta['model'] ?? 'unknown')
    const errClass = meta['error_class'] ? String(meta['error_class']) : null
    const runs = Number(row.runs ?? 1)
    const fails = Number(row.failures ?? 0)
    const budget = Number(row.budget_used ?? 0)
    const at = row.observed_at as string | null

    calls += runs
    failures += fails
    tokens += budget
    if (typeof row.latency_ms === 'number') {
      latency += row.latency_ms
      latencyN += 1
    }

    const f = features.get(feature) ?? {
      calls: 0, failures: 0, latency: 0, latencyN: 0, tokens: 0, last: null, errs: new Map<string, number>(),
    }
    f.calls += runs
    f.failures += fails
    f.tokens += budget
    if (typeof row.latency_ms === 'number') {
      f.latency += row.latency_ms
      f.latencyN += 1
    }
    if (at && (!f.last || at > f.last)) f.last = at
    if (errClass) f.errs.set(errClass, (f.errs.get(errClass) ?? 0) + 1)
    features.set(feature, f)

    if (errClass) errorClasses.set(errClass, (errorClasses.get(errClass) ?? 0) + 1)

    const m = models.get(model) ?? { calls: 0, failures: 0 }
    m.calls += runs
    m.failures += fails
    models.set(model, m)
  }

  const byFeature: AiFeatureHealth[] = Array.from(features.entries())
    .map(([feature, v]) => {
      const errorRate = v.calls > 0 ? v.failures / v.calls : 0
      let topErrorClass: string | null = null
      let topCount = 0
      v.errs.forEach((count, klass) => {
        if (count > topCount) {
          topCount = count
          topErrorClass = klass
        }
      })
      return {
        feature,
        calls: v.calls,
        failures: v.failures,
        errorRate,
        avgLatencyMs: v.latencyN > 0 ? Math.round(v.latency / v.latencyN) : 0,
        tokens: v.tokens,
        topErrorClass,
        lastSeen: v.last,
        status: statusFor(v.calls, errorRate),
      }
    })
    .sort((a, b) => b.calls - a.calls)

  return {
    windowHours: hours,
    totals: {
      calls,
      failures,
      errorRate: calls > 0 ? failures / calls : 0,
      tokens,
      avgLatencyMs: latencyN > 0 ? Math.round(latency / latencyN) : 0,
    },
    byFeature,
    byErrorClass: Array.from(errorClasses.entries())
      .map(([errorClass, count]) => ({ errorClass, count }))
      .sort((a, b) => b.count - a.count),
    byModel: Array.from(models.entries())
      .map(([model, v]) => ({ model, calls: v.calls, failures: v.failures }))
      .sort((a, b) => b.calls - a.calls),
    providers: {
      openaiKeyConfigured: Boolean(process.env['OPENAI_API_KEY']),
      gatewayKeyConfigured: Boolean(process.env['LOVABLE_API_KEY']),
    },
  }
}
