// Segment rule DSL — evaluated against the database, not hardcoded.
// A segment stores an array of rules + combinator (`and` | `or`).
// The engine (src/lib/segments/engine.server.ts) translates the DSL to
// live queries against real tables (crm_customers, crm_loyalty_*, orders).
import { z } from 'zod'

export const segmentRule = z.discriminatedUnion('op', [
  z.object({ op: z.literal('is_new_within_days'), days: z.number().int().min(1).max(3650) }),
  z.object({ op: z.literal('is_inactive_days'),   days: z.number().int().min(1).max(3650) }),
  z.object({ op: z.literal('city_equals'),        value: z.string().min(1).max(120) }),
  z.object({ op: z.literal('has_tag'),            value: z.string().min(1).max(60) }),
  z.object({ op: z.literal('loyalty_tier_code'),  value: z.string().min(1).max(40) }),
  z.object({ op: z.literal('min_points_balance'), value: z.number().int().min(0) }),
  z.object({ op: z.literal('max_points_balance'), value: z.number().int().min(0) }),
  z.object({ op: z.literal('total_spend_gte'),    value: z.number().min(0) }),
  z.object({ op: z.literal('order_count_gte'),    value: z.number().int().min(0) }),
  z.object({ op: z.literal('recent_prescription_days'), days: z.number().int().min(1).max(3650) }),
  z.object({ op: z.literal('customer_status'),    value: z.enum(['active','archived','merged']) }),
])
export type SegmentRule = z.infer<typeof segmentRule>

export const segmentRulesArray = z.array(segmentRule).max(20)
export type SegmentRulesArray = z.infer<typeof segmentRulesArray>

export const CAMPAIGN_TRANSITIONS: Record<string, string[]> = {
  draft:     ['scheduled','running','cancelled'],
  scheduled: ['running','cancelled','draft'],
  running:   ['paused','completed','cancelled'],
  paused:    ['running','cancelled','completed'],
  completed: [],
  cancelled: [],
}
export function isLegalTransition(from: string, to: string): boolean {
  return (CAMPAIGN_TRANSITIONS[from] ?? []).includes(to)
}
