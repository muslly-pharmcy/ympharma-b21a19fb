// Sun Core planetary telemetry — health, latency, error rate and budget per module.
// Written by module wrappers, read by the kernel router and admin dashboard.

export const MODULE_KEYS = [
  'inventory',
  'clinical',
  'ocr',
  'social',
  'crm',
  'analytics',
  'tools',
  'kernel',
] as const

export type ModuleKey = (typeof MODULE_KEYS)[number]

export interface TelemetrySample {
  moduleKey: ModuleKey
  latencyMs?: number
  ok: boolean
  budgetUsed?: number
  meta?: Record<string, unknown>
}

/** Record a single module execution. Never throws. */
export async function recordModuleRun(sample: TelemetrySample): Promise<void> {
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    await supabaseAdmin.from('kernel_module_telemetry').insert({
      module_key: sample.moduleKey,
      status: sample.ok ? 'healthy' : 'degraded',
      latency_ms: sample.latencyMs ?? null,
      error_rate: sample.ok ? 0 : 1,
      budget_used: sample.budgetUsed ?? 0,
      runs: 1,
      failures: sample.ok ? 0 : 1,
      meta: (sample.meta ?? {}) as never,
    })
  } catch (e) {
    console.warn('[telemetry] skipped', (e as Error).message)
  }
}

/**
 * Wrap any module call with telemetry + a self-healing fallback.
 * On failure the fallback value is returned instead of throwing.
 */
export async function withModuleTelemetry<T>(
  moduleKey: ModuleKey,
  fn: () => Promise<T>,
  fallback?: () => T,
): Promise<T> {
  const started = Date.now()
  try {
    const result = await fn()
    void recordModuleRun({ moduleKey, ok: true, latencyMs: Date.now() - started })
    return result
  } catch (e) {
    void recordModuleRun({
      moduleKey,
      ok: false,
      latencyMs: Date.now() - started,
      meta: { error: (e as Error).message?.slice(0, 300) },
    })
    if (fallback) return fallback()
    throw e
  }
}

export interface ModuleStatus {
  moduleKey: string
  runs: number
  failures: number
  errorRate: number
  avgLatencyMs: number
  budgetUsed: number
  status: 'healthy' | 'degraded' | 'critical' | 'idle'
  lastSeen: string | null
}

/** Aggregate the last N hours of telemetry into a planetary status board. */
export async function planetaryStatus(hours = 24): Promise<ModuleStatus[]> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const since = new Date(Date.now() - hours * 3600_000).toISOString()
  const { data } = await supabaseAdmin
    .from('kernel_module_telemetry')
    .select('module_key, latency_ms, failures, runs, budget_used, observed_at')
    .gte('observed_at', since)
    .limit(5000)

  const acc = new Map<string, { runs: number; failures: number; latency: number; latencyN: number; budget: number; last: string | null }>()
  for (const key of MODULE_KEYS) acc.set(key, { runs: 0, failures: 0, latency: 0, latencyN: 0, budget: 0, last: null })

  for (const row of data ?? []) {
    const key = row.module_key as string
    const cur = acc.get(key) ?? { runs: 0, failures: 0, latency: 0, latencyN: 0, budget: 0, last: null }
    cur.runs += (row.runs as number) ?? 0
    cur.failures += (row.failures as number) ?? 0
    if (typeof row.latency_ms === 'number') {
      cur.latency += row.latency_ms
      cur.latencyN += 1
    }
    cur.budget += Number(row.budget_used ?? 0)
    const at = row.observed_at as string
    if (!cur.last || at > cur.last) cur.last = at
    acc.set(key, cur)
  }

  return Array.from(acc.entries()).map(([moduleKey, v]) => {
    const errorRate = v.runs > 0 ? v.failures / v.runs : 0
    const status: ModuleStatus['status'] =
      v.runs === 0 ? 'idle' : errorRate >= 0.3 ? 'critical' : errorRate > 0.05 ? 'degraded' : 'healthy'
    return {
      moduleKey,
      runs: v.runs,
      failures: v.failures,
      errorRate: Math.round(errorRate * 1000) / 1000,
      avgLatencyMs: v.latencyN ? Math.round(v.latency / v.latencyN) : 0,
      budgetUsed: Math.round(v.budget * 10000) / 10000,
      status,
      lastSeen: v.last,
    }
  })
}
