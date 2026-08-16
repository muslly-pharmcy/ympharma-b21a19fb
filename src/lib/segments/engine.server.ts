// Segment engine — evaluates a DSL against real tables and returns matching
// customer IDs. All rules are stored in the database (crm_segments.rules)
// so adding/removing rules never requires code changes for the existing ops.
// Pure functions here are unit-tested; the resolver hits Supabase.
import type { SegmentRule } from '@/domain/crm/segment-dsl'

export interface EvalOptions {
  organizationId: string
  rules: SegmentRule[]
  combinator: 'and' | 'or'
  now?: Date
  limit?: number
}

// Small helper: intersect two sets.
function intersect<T>(a: Set<T>, b: Set<T>): Set<T> {
  const out = new Set<T>()
  for (const v of a) if (b.has(v)) out.add(v)
  return out
}
function union<T>(a: Set<T>, b: Set<T>): Set<T> {
  const out = new Set(a)
  for (const v of b) out.add(v)
  return out
}

// Turn a rule into a Set<customer_id> for the org. Runs one query per rule.
async function resolveRule(
  rule: SegmentRule,
  orgId: string,
  now: Date,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
): Promise<Set<string>> {
  const iso = (d: Date) => d.toISOString()
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86400_000)

  switch (rule.op) {
    case 'is_new_within_days': {
      const { data } = await sb.from('crm_customers').select('id')
        .eq('organization_id', orgId).gte('created_at', iso(daysAgo(rule.days)))
      return new Set((data ?? []).map((r: { id: string }) => r.id))
    }
    case 'is_inactive_days': {
      // Customer with no loyalty txn (earn/redeem) in last N days.
      const cutoff = iso(daysAgo(rule.days))
      const [{ data: all }, { data: active }] = await Promise.all([
        sb.from('crm_customers').select('id').eq('organization_id', orgId),
        sb.from('crm_loyalty_transactions').select('customer_id')
          .eq('organization_id', orgId).gte('created_at', cutoff),
      ])
      const activeIds = new Set((active ?? []).map((r: { customer_id: string }) => r.customer_id))
      return new Set((all ?? []).map((r: { id: string }) => r.id).filter((id: string) => !activeIds.has(id)))
    }
    case 'city_equals': {
      const { data } = await sb.from('crm_customer_addresses').select('customer_id')
        .eq('organization_id', orgId).ilike('city', rule.value)
      return new Set((data ?? []).map((r: { customer_id: string }) => r.customer_id))
    }
    case 'has_tag': {
      const { data } = await sb.from('crm_customer_tags').select('customer_id')
        .eq('organization_id', orgId).eq('tag', rule.value)
      return new Set((data ?? []).map((r: { customer_id: string }) => r.customer_id))
    }
    case 'loyalty_tier_code': {
      const { data: tier } = await sb.from('crm_loyalty_tiers').select('id')
        .eq('organization_id', orgId).eq('code', rule.value).maybeSingle()
      if (!tier?.id) return new Set<string>()
      const { data } = await sb.from('crm_loyalty_accounts').select('customer_id')
        .eq('organization_id', orgId).eq('current_tier_id', tier.id)
      return new Set((data ?? []).map((r: { customer_id: string }) => r.customer_id))
    }
    case 'min_points_balance': {
      const { data } = await sb.from('crm_loyalty_accounts').select('customer_id')
        .eq('organization_id', orgId).gte('points_balance', rule.value)
      return new Set((data ?? []).map((r: { customer_id: string }) => r.customer_id))
    }
    case 'max_points_balance': {
      const { data } = await sb.from('crm_loyalty_accounts').select('customer_id')
        .eq('organization_id', orgId).lte('points_balance', rule.value)
      return new Set((data ?? []).map((r: { customer_id: string }) => r.customer_id))
    }
    case 'total_spend_gte': {
      // Proxy: lifetime earned points from loyalty ledger (spend correlates to earn).
      const { data } = await sb.from('crm_loyalty_accounts').select('customer_id, points_lifetime_earned')
        .eq('organization_id', orgId)
      return new Set(
        (data ?? []).filter((r: { points_lifetime_earned: number }) => Number(r.points_lifetime_earned) >= rule.value)
          .map((r: { customer_id: string }) => r.customer_id),
      )
    }
    case 'order_count_gte': {
      // Uses hc_dispenses as proxy for fulfilled orders scoped by org.
      const { data } = await sb.from('hc_dispenses').select('patient_id')
        .eq('organization_id', orgId)
      const counts = new Map<string, number>()
      for (const r of ((data ?? []) as Array<{ patient_id: string }>)) {
        if (!r.patient_id) continue
        counts.set(r.patient_id, (counts.get(r.patient_id) ?? 0) + 1)
      }
      const patientIds = Array.from(counts.entries()).filter(([, c]) => c >= rule.value).map(([p]) => p)
      if (patientIds.length === 0) return new Set<string>()
      const { data: cust } = await sb.from('crm_customers').select('id')
        .eq('organization_id', orgId).in('patient_id', patientIds)
      return new Set((cust ?? []).map((r: { id: string }) => r.id))
    }
    case 'recent_prescription_days': {
      const cutoff = iso(daysAgo(rule.days))
      const { data: rx } = await sb.from('hc_prescriptions').select('patient_id')
        .eq('organization_id', orgId).gte('created_at', cutoff)
      const patientIds = Array.from(new Set(((rx ?? []) as Array<{ patient_id: string }>).map((r) => r.patient_id).filter(Boolean)))
      if (patientIds.length === 0) return new Set<string>()
      const { data: cust } = await sb.from('crm_customers').select('id')
        .eq('organization_id', orgId).in('patient_id', patientIds)
      return new Set((cust ?? []).map((r: { id: string }) => r.id))
    }
    case 'customer_status': {
      const { data } = await sb.from('crm_customers').select('id')
        .eq('organization_id', orgId).eq('status', rule.value)
      return new Set((data ?? []).map((r: { id: string }) => r.id))
    }
  }
}

export async function evaluateSegment(opts: EvalOptions): Promise<string[]> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb: any = supabaseAdmin as any
  const now = opts.now ?? new Date()

  if (opts.rules.length === 0) {
    // Empty ruleset = every active customer in the org.
    const { data } = await sb.from('crm_customers').select('id')
      .eq('organization_id', opts.organizationId).eq('status', 'active')
    const ids = (data ?? []).map((r: { id: string }) => r.id) as string[]
    return opts.limit ? ids.slice(0, opts.limit) : ids
  }

  const sets = await Promise.all(opts.rules.map((r) => resolveRule(r, opts.organizationId, now, sb)))
  let out = sets[0] ?? new Set<string>()
  for (let i = 1; i < sets.length; i++) {
    out = opts.combinator === 'or' ? union(out, sets[i]) : intersect(out, sets[i])
  }
  const arr = Array.from(out)
  return opts.limit ? arr.slice(0, opts.limit) : arr
}

// Pure combinator helper — exposed for unit tests.
export function combineSets(sets: Set<string>[], combinator: 'and' | 'or'): Set<string> {
  if (sets.length === 0) return new Set()
  let out = sets[0]
  for (let i = 1; i < sets.length; i++) {
    out = combinator === 'or' ? union(out, sets[i]) : intersect(out, sets[i])
  }
  return out
}
