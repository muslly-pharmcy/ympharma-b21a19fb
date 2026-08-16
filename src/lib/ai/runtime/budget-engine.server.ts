// Budget Engine — enforces token / cost / latency limits across daily / monthly / emergency
// windows. Reservations happen BEFORE the call; actual consumption is settled AFTER.
import type { BudgetRow } from './types'

async function admin() {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  // Typed client — proxy preserves SupabaseClient<Database> typing.
  return supabaseAdmin
}

function windowStart(period: BudgetRow['period']): Date {
  const now = new Date()
  if (period === 'daily') { now.setUTCHours(0, 0, 0, 0); return now }
  if (period === 'monthly') { now.setUTCDate(1); now.setUTCHours(0, 0, 0, 0); return now }
  return now // emergency = no rotation
}

async function fetchOrCreate(orgId: string, scope: string, period: BudgetRow['period']): Promise<BudgetRow | null> {
  const sb = await admin()
  const { data } = await sb.from('air_budgets')
    .select('*').eq('organization_id', orgId).eq('scope', scope).eq('period', period).maybeSingle()
  if (!data) return null
  const row = data as BudgetRow
  // Rotate window if elapsed.
  const start = windowStart(period).toISOString()
  if (period !== 'emergency' && new Date(row.window_start) < new Date(start)) {
    await sb.from('air_budgets').update({
      consumed_tokens: 0, consumed_cost_cents: 0, window_start: start,
    }).eq('id', row.id)
    return { ...row, consumed_tokens: 0, consumed_cost_cents: 0, window_start: start }
  }
  return row
}

export interface BudgetCheck {
  allowed: boolean
  deniedReason?: string
  scope: string
  budget?: BudgetRow
}

export async function checkBudgets(orgId: string, agentKey: string): Promise<BudgetCheck> {
  for (const scope of [`agent:${agentKey}`, 'global']) {
    for (const period of ['emergency', 'daily', 'monthly'] as const) {
      const b = await fetchOrCreate(orgId, scope, period)
      if (!b || !b.is_active) continue
      if (b.token_limit != null && b.consumed_tokens >= b.token_limit) {
        return { allowed: false, deniedReason: `token budget exhausted (${scope}/${period})`, scope, budget: b }
      }
      if (b.cost_limit_cents != null && b.consumed_cost_cents >= b.cost_limit_cents) {
        return { allowed: false, deniedReason: `cost budget exhausted (${scope}/${period})`, scope, budget: b }
      }
    }
  }
  return { allowed: true, scope: 'ok' }
}

export async function settleBudgets(orgId: string, agentKey: string, tokens: number, costCents: number): Promise<void> {
  const sb = await admin()
  for (const scope of [`agent:${agentKey}`, 'global']) {
    for (const period of ['daily', 'monthly'] as const) {
      const b = await fetchOrCreate(orgId, scope, period)
      if (!b) continue
      await sb.from('air_budgets').update({
        consumed_tokens: b.consumed_tokens + Math.max(0, tokens),
        consumed_cost_cents: b.consumed_cost_cents + Math.max(0, costCents),
      }).eq('id', b.id)
    }
  }
}
