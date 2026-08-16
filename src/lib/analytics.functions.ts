// Analytics server functions — org-scoped KPI + time-series queries.
// Uses supabaseAdmin filtered by actor.organizationId to bypass RLS safely
// after RBAC has been verified server-side (requirePermission('analytics.read')).
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

// ---------- Types (plain DTOs — no rich objects across RPC) ----------
export interface ExecutiveKpis {
  dispenses_today: number
  dispenses_7d: number
  dispenses_30d: number
  new_customers_7d: number
  active_customers_30d: number
  loyalty_points_earned_30d: number
  loyalty_points_redeemed_30d: number
  campaigns_active: number
  ai_runs_24h: number
  low_stock_items: number
  expiring_soon_items: number
  as_of: string
}

export interface SeriesPoint { date: string; value: number }
export interface CampaignPerf {
  id: string; name: string; channel: string; status: string
  audience_size: number; sent_count: number; delivered_count: number; failed_count: number
}
export interface InventoryHealth {
  low_stock: number; expiring_30d: number; expiring_90d: number
  total_batches: number; out_of_stock: number
}
export interface AiUsage {
  runs_24h: number; runs_7d: number
  tokens_24h: number; tokens_7d: number
  avg_latency_ms_7d: number
  top_agents: Array<{ agent_key: string; runs: number }>
}

// ---------- Helpers ----------
function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString()
}

async function loadActor() {
  const { getActor, requirePermission } = await import('./session.server')
  const actor = await getActor()
  requirePermission(actor, 'analytics.read')
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  return { actor, sb: supabaseAdmin }
}

// ---------- getExecutiveKpis ----------
export const getExecutiveKpis = createServerFn({ method: 'GET' }).handler(async (): Promise<ExecutiveKpis> => {
  const { actor, sb } = await loadActor()
  const org = actor.organizationId
  const now = new Date()
  const todayStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()).toISOString()
  const d7 = isoDaysAgo(7)
  const d30 = isoDaysAgo(30)
  const d1 = isoDaysAgo(1)
  const in30 = new Date(now.getTime() + 30 * 86_400_000).toISOString().slice(0, 10)

  const count = (v: { count: number | null } | null | undefined) => v?.count ?? 0

  const [
    dispToday, disp7, disp30,
    newCust7, actCust30,
    loyEarned30, loyRedeemed30,
    campActive, aiRuns24,
    lowStock, expSoon,
  ] = await Promise.all([
    sb.from('hc_dispenses').select('id', { count: 'exact', head: true }).eq('organization_id', org).gte('created_at', todayStart),
    sb.from('hc_dispenses').select('id', { count: 'exact', head: true }).eq('organization_id', org).gte('created_at', d7),
    sb.from('hc_dispenses').select('id', { count: 'exact', head: true }).eq('organization_id', org).gte('created_at', d30),
    sb.from('crm_customers').select('id', { count: 'exact', head: true }).eq('organization_id', org).gte('created_at', d7),
    sb.from('crm_customers').select('id', { count: 'exact', head: true }).eq('organization_id', org).eq('status', 'active'),
    sb.from('crm_loyalty_transactions').select('points').eq('organization_id', org).eq('kind', 'earn').gte('created_at', d30),
    sb.from('crm_loyalty_transactions').select('points').eq('organization_id', org).eq('kind', 'redeem').gte('created_at', d30),
    sb.from('crm_campaigns').select('id', { count: 'exact', head: true }).eq('organization_id', org).in('status', ['running', 'scheduled']),
    sb.from('air_runs').select('id', { count: 'exact', head: true }).eq('organization_id', org).gte('created_at', d1),
    sb.from('inv_stock_batches').select('id', { count: 'exact', head: true }).eq('organization_id', org).lte('qty_on_hand', 10),
    sb.from('inv_stock_batches').select('id', { count: 'exact', head: true }).eq('organization_id', org).gt('qty_on_hand', 0).lte('expiry_date', in30),
  ])

  const sumPoints = (rows: Array<{ points: number | null }> | null | undefined) =>
    (rows ?? []).reduce((s, r) => s + Math.abs(Number(r.points ?? 0)), 0)

  return {
    dispenses_today: count(dispToday),
    dispenses_7d: count(disp7),
    dispenses_30d: count(disp30),
    new_customers_7d: count(newCust7),
    active_customers_30d: count(actCust30),
    loyalty_points_earned_30d: sumPoints(loyEarned30.data),
    loyalty_points_redeemed_30d: sumPoints(loyRedeemed30.data),
    campaigns_active: count(campActive),
    ai_runs_24h: count(aiRuns24),
    low_stock_items: count(lowStock),
    expiring_soon_items: count(expSoon),
    as_of: new Date().toISOString(),
  }
})

// ---------- getSalesSeries (dispenses per day) ----------
const seriesInput = z.object({ days: z.number().int().min(1).max(90).default(14) })

export const getDispensesSeries = createServerFn({ method: 'GET' })
  .validator((raw: unknown) => seriesInput.parse(raw ?? {}))
  .handler(async ({ data }): Promise<SeriesPoint[]> => {
    const { actor, sb } = await loadActor()
    const from = isoDaysAgo(data.days)
    const { data: rows, error } = await sb
      .from('hc_dispenses')
      .select('created_at')
      .eq('organization_id', actor.organizationId)
      .gte('created_at', from)
      .limit(10_000)
    if (error) throw new Error(error.message)
    const buckets = new Map<string, number>()
    for (let i = data.days - 1; i >= 0; i--) {
      const d = new Date()
      d.setUTCDate(d.getUTCDate() - i)
      buckets.set(d.toISOString().slice(0, 10), 0)
    }
    for (const r of rows ?? []) {
      const k = String(r.created_at).slice(0, 10)
      if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1)
    }
    return [...buckets.entries()].map(([date, value]) => ({ date, value }))
  })

// ---------- getCustomersGrowth ----------
export const getCustomersGrowth = createServerFn({ method: 'GET' })
  .validator((raw: unknown) => seriesInput.parse(raw ?? {}))
  .handler(async ({ data }): Promise<SeriesPoint[]> => {
    const { actor, sb } = await loadActor()
    const from = isoDaysAgo(data.days)
    const { data: rows, error } = await sb
      .from('crm_customers')
      .select('created_at')
      .eq('organization_id', actor.organizationId)
      .gte('created_at', from)
      .limit(10_000)
    if (error) throw new Error(error.message)
    const buckets = new Map<string, number>()
    for (let i = data.days - 1; i >= 0; i--) {
      const d = new Date()
      d.setUTCDate(d.getUTCDate() - i)
      buckets.set(d.toISOString().slice(0, 10), 0)
    }
    for (const r of rows ?? []) {
      const k = String(r.created_at).slice(0, 10)
      if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1)
    }
    return [...buckets.entries()].map(([date, value]) => ({ date, value }))
  })

// ---------- getCampaignsSummary ----------
export const getCampaignsSummary = createServerFn({ method: 'GET' }).handler(async (): Promise<CampaignPerf[]> => {
  const { actor, sb } = await loadActor()
  const { data, error } = await sb
    .from('crm_campaigns')
    .select('id, name, channel, status, audience_size, sent_count, delivered_count, failed_count')
    .eq('organization_id', actor.organizationId)
    .order('updated_at', { ascending: false })
    .limit(10)
  if (error) throw new Error(error.message)
  return (data ?? []) as CampaignPerf[]
})

// ---------- getInventoryHealth ----------
export const getInventoryHealth = createServerFn({ method: 'GET' }).handler(async (): Promise<InventoryHealth> => {
  const { actor, sb } = await loadActor()
  const org = actor.organizationId
  const now = new Date()
  const in30 = new Date(now.getTime() + 30 * 86_400_000).toISOString().slice(0, 10)
  const in90 = new Date(now.getTime() + 90 * 86_400_000).toISOString().slice(0, 10)
  const [low, exp30, exp90, total, oos] = await Promise.all([
    sb.from('inv_stock_batches').select('id', { count: 'exact', head: true }).eq('organization_id', org).gt('qty_on_hand', 0).lte('qty_on_hand', 10),
    sb.from('inv_stock_batches').select('id', { count: 'exact', head: true }).eq('organization_id', org).gt('qty_on_hand', 0).lte('expiry_date', in30),
    sb.from('inv_stock_batches').select('id', { count: 'exact', head: true }).eq('organization_id', org).gt('qty_on_hand', 0).lte('expiry_date', in90),
    sb.from('inv_stock_batches').select('id', { count: 'exact', head: true }).eq('organization_id', org),
    sb.from('inv_stock_batches').select('id', { count: 'exact', head: true }).eq('organization_id', org).lte('qty_on_hand', 0),
  ])
  return {
    low_stock: low.count ?? 0,
    expiring_30d: exp30.count ?? 0,
    expiring_90d: exp90.count ?? 0,
    total_batches: total.count ?? 0,
    out_of_stock: oos.count ?? 0,
  }
})

// ---------- getAiUsage ----------
export const getAiUsage = createServerFn({ method: 'GET' }).handler(async (): Promise<AiUsage> => {
  const { actor, sb } = await loadActor()
  const org = actor.organizationId
  const d1 = isoDaysAgo(1)
  const d7 = isoDaysAgo(7)
  const [{ data: rows7, error }, r24, r7] = await Promise.all([
    sb.from('air_runs').select('agent_key, total_tokens, latency_ms').eq('organization_id', org).gte('created_at', d7).limit(5_000),
    sb.from('air_runs').select('id', { count: 'exact', head: true }).eq('organization_id', org).gte('created_at', d1),
    sb.from('air_runs').select('id', { count: 'exact', head: true }).eq('organization_id', org).gte('created_at', d7),
  ])
  if (error) throw new Error(error.message)
  const rows = rows7 ?? []
  const tokens7 = rows.reduce((s, r) => s + Number(r.total_tokens ?? 0), 0)
  const latSum = rows.reduce((s, r) => s + Number(r.latency_ms ?? 0), 0)
  const avgLat = rows.length ? Math.round(latSum / rows.length) : 0
  const agentCounts = new Map<string, number>()
  for (const r of rows) agentCounts.set(String(r.agent_key), (agentCounts.get(String(r.agent_key)) ?? 0) + 1)
  const topAgents = [...agentCounts.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([agent_key, runs]) => ({ agent_key, runs }))
  return {
    runs_24h: r24.count ?? 0,
    runs_7d: r7.count ?? 0,
    tokens_24h: 0, // detailed 24h token sum omitted — heavy scan; expose in E2 via MV.
    tokens_7d: tokens7,
    avg_latency_ms_7d: avgLat,
    top_agents: topAgents,
  }
})
