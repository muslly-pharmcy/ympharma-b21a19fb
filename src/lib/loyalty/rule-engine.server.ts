// Pure loyalty rule engine. Evaluates active rules against a context and
// returns a list of point awards + a total. Kept in a *.server.ts module so
// the tests can import it directly and no client bundle can pull it in.
import type { LoyaltyRule } from '@/domain/loyalty/schemas'

export interface RuleContext {
  customerId: string
  amountSpent?: number
  category?: string
  isFirstPurchase?: boolean
  birthday?: string | null // ISO date (YYYY-MM-DD)
  now?: Date
}

export interface RuleAward {
  ruleKey: string
  ruleKind: LoyaltyRule['kind']
  points: number
  detail: string
}

function withinWindow(rule: LoyaltyRule, now: Date): boolean {
  if (rule.valid_from && new Date(rule.valid_from) > now) return false
  if (rule.valid_to && new Date(rule.valid_to) < now) return false
  return true
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : fallback
}

export function evaluateRules(rules: LoyaltyRule[], ctx: RuleContext): { awards: RuleAward[]; total: number } {
  const now = ctx.now ?? new Date()
  const active = rules
    .filter((r) => r.is_active && withinWindow(r, now))
    .sort((a, b) => a.priority - b.priority)

  let multiplier = 1
  const awards: RuleAward[] = []

  // First pass: window-based multipliers apply to spend_earn awards.
  for (const r of active) {
    if (r.kind !== 'double_points_window') continue
    const m = num((r.config as Record<string, unknown>).multiplier, 2)
    if (m > multiplier) multiplier = m
  }

  for (const r of active) {
    const cfg = r.config as Record<string, unknown>
    switch (r.kind) {
      case 'spend_earn': {
        const per = num(cfg.per_currency_unit, 1) // spend units per point
        if (per <= 0 || !ctx.amountSpent || ctx.amountSpent <= 0) break
        const points = Math.floor((ctx.amountSpent / per) * multiplier)
        if (points > 0) awards.push({ ruleKey: r.key, ruleKind: r.kind, points, detail: `spend ${ctx.amountSpent} × ${multiplier}` })
        break
      }
      case 'category_bonus': {
        const target = String(cfg.category ?? '').toLowerCase()
        if (!target || !ctx.category || ctx.category.toLowerCase() !== target) break
        const bonus = num(cfg.bonus_points, 0)
        if (bonus > 0) awards.push({ ruleKey: r.key, ruleKind: r.kind, points: bonus, detail: `category ${target}` })
        break
      }
      case 'first_purchase_bonus': {
        if (!ctx.isFirstPurchase) break
        const bonus = num(cfg.bonus_points, 0)
        if (bonus > 0) awards.push({ ruleKey: r.key, ruleKind: r.kind, points: bonus, detail: 'first purchase' })
        break
      }
      case 'birthday_bonus': {
        if (!ctx.birthday) break
        const b = new Date(ctx.birthday)
        if (b.getUTCMonth() === now.getUTCMonth() && b.getUTCDate() === now.getUTCDate()) {
          const bonus = num(cfg.bonus_points, 0)
          if (bonus > 0) awards.push({ ruleKey: r.key, ruleKind: r.kind, points: bonus, detail: 'birthday' })
        }
        break
      }
      case 'double_points_window':
        // Already folded into multiplier above.
        break
    }
  }

  return { awards, total: awards.reduce((s, a) => s + a.points, 0) }
}
