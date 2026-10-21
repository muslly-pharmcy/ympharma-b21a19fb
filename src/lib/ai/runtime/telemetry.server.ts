import {completeRows,readAllReportRows} from '../../reports/report-source'
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
export async function planetaryStatus(hours = 24, end = new Date()): Promise<ModuleStatus[]> {
  if(!Number.isFinite(hours)||hours<=0||hours>168||!Number.isFinite(end.getTime()))throw Error('TELEMETRY_INVALID_WINDOW')
  const until=end.toISOString()
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const since = new Date(end.getTime() - hours * 3600_000).toISOString()
  const result = await readAllReportRows((start,finish)=>supabaseAdmin
    .from('kernel_module_telemetry')
    .select('id, module_key, latency_ms, failures, runs, budget_used, observed_at',{count:'exact'})
    .gte('observed_at', since)
    .lt('observed_at', until)
    .order('id',{ascending:true})
    .range(start,finish))

  const acc = new Map<string, { runs: number; failures: number; latency: number; latencyN: number; budget: number; last: string | null }>()
  for (const key of MODULE_KEYS) acc.set(key, { runs: 0, failures: 0, latency: 0, latencyN: 0, budget: 0, last: null })

  for (const row of completeRows(result)) {
    const atMs=typeof row.observed_at==='string'?Date.parse(row.observed_at):NaN
    const budget=typeof row.budget_used==='number'?row.budget_used:typeof row.budget_used==='string'&&/^(0|[1-9]\d*)(?:\.\d{1,4})?$/.test(row.budget_used)?Number(row.budget_used):NaN
    if(typeof row.module_key!=='string'||!row.module_key.trim()||row.module_key.length>100||
      !Number.isSafeInteger(row.runs)||row.runs<0||!Number.isSafeInteger(row.failures)||row.failures<0||row.failures>row.runs||
      (row.latency_ms!==null&&(typeof row.latency_ms!=='number'||!Number.isFinite(row.latency_ms)||row.latency_ms<0))||
      !Number.isFinite(budget)||budget<0||budget>Number.MAX_SAFE_INTEGER/10000||
      !Number.isFinite(atMs)||atMs<Date.parse(since)||atMs>=end.getTime())throw Error('TELEMETRY_INVALID_SAMPLE')
    const key = row.module_key
    const cur = acc.get(key) ?? { runs: 0, failures: 0, latency: 0, latencyN: 0, budget: 0, last: null }
    cur.runs += (row.runs as number) ?? 0
    cur.failures += (row.failures as number) ?? 0
    if (typeof row.latency_ms === 'number') {
      cur.latency += row.latency_ms
      cur.latencyN += 1
    }
    cur.budget += budget
    if(!Number.isSafeInteger(cur.runs)||!Number.isSafeInteger(cur.failures)||!Number.isFinite(cur.latency)||cur.budget>Number.MAX_SAFE_INTEGER/10000)throw Error('TELEMETRY_AGGREGATE_OVERFLOW')
    const at = new Date(atMs).toISOString()
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
