import { describe, it, expect } from 'vitest'
import { evaluateRules } from '@/lib/loyalty/rule-engine.server'
import type { LoyaltyRule } from '@/domain/loyalty/schemas'

const rule = (p: Partial<LoyaltyRule> & Pick<LoyaltyRule, 'kind' | 'config'>): LoyaltyRule => ({
  id: p.id ?? 'r', organization_id: 'o', key: p.key ?? 'k', name: p.name ?? 'n',
  priority: p.priority ?? 100, is_active: p.is_active ?? true,
  valid_from: p.valid_from ?? null, valid_to: p.valid_to ?? null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  kind: p.kind, config: p.config,
})

describe('loyalty rule engine', () => {
  it('spend_earn awards floor(amount / per) points', () => {
    const r = evaluateRules([rule({ kind: 'spend_earn', config: { per_currency_unit: 10 } })], {
      customerId: 'c', amountSpent: 95,
    })
    expect(r.total).toBe(9)
  })

  it('double_points_window multiplies spend_earn awards', () => {
    const r = evaluateRules([
      rule({ kind: 'spend_earn', config: { per_currency_unit: 10 } }),
      rule({ key: 'dbl', kind: 'double_points_window', config: { multiplier: 2 }, priority: 1 }),
    ], { customerId: 'c', amountSpent: 100 })
    expect(r.total).toBe(20)
  })

  it('category_bonus fires only for matching category', () => {
    const rules = [rule({ kind: 'category_bonus', config: { category: 'antibiotics', bonus_points: 50 } })]
    expect(evaluateRules(rules, { customerId: 'c', category: 'antibiotics' }).total).toBe(50)
    expect(evaluateRules(rules, { customerId: 'c', category: 'vitamins' }).total).toBe(0)
  })

  it('first_purchase_bonus fires only when flagged', () => {
    const rules = [rule({ kind: 'first_purchase_bonus', config: { bonus_points: 100 } })]
    expect(evaluateRules(rules, { customerId: 'c', isFirstPurchase: true }).total).toBe(100)
    expect(evaluateRules(rules, { customerId: 'c' }).total).toBe(0)
  })

  it('birthday_bonus fires on matching month/day', () => {
    const rules = [rule({ kind: 'birthday_bonus', config: { bonus_points: 200 } })]
    const now = new Date(Date.UTC(2026, 6, 20))
    expect(evaluateRules(rules, { customerId: 'c', birthday: '1990-07-20', now }).total).toBe(200)
    expect(evaluateRules(rules, { customerId: 'c', birthday: '1990-07-21', now }).total).toBe(0)
  })

  it('inactive or out-of-window rules are ignored', () => {
    const r = evaluateRules([
      rule({ kind: 'spend_earn', config: { per_currency_unit: 1 }, is_active: false }),
      rule({ kind: 'spend_earn', config: { per_currency_unit: 1 }, valid_to: '2000-01-01T00:00:00Z' }),
    ], { customerId: 'c', amountSpent: 100 })
    expect(r.total).toBe(0)
  })

  it('emits award traces with rule keys', () => {
    const r = evaluateRules([
      rule({ key: 'earn', kind: 'spend_earn', config: { per_currency_unit: 10 } }),
      rule({ key: 'cat', kind: 'category_bonus', config: { category: 'vitamins', bonus_points: 20 } }),
    ], { customerId: 'c', amountSpent: 100, category: 'vitamins' })
    expect(r.awards.map((a) => a.ruleKey).sort()).toEqual(['cat', 'earn'])
  })
})
