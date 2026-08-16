import { describe, it, expect } from 'vitest'
import { evaluatePromotions } from '@/lib/promotions/engine.server'
import type { Promotion, PromoWithMeta, PromotionTarget, PromotionEligibility } from '@/domain/promotions/schemas'

const P = (p: Partial<Promotion> & Pick<Promotion, 'code' | 'kind' | 'config'>): Promotion => ({
  id: p.id ?? p.code, organization_id: 'o', code: p.code, name: p.code,
  description: null, kind: p.kind, config: p.config,
  status: p.status ?? 'active', priority: p.priority ?? 100,
  stackable: p.stackable ?? false, min_spend: p.min_spend ?? null,
  max_discount: p.max_discount ?? null, starts_at: p.starts_at ?? null,
  expires_at: p.expires_at ?? null, usage_limit: p.usage_limit ?? null,
  usage_count: p.usage_count ?? 0, per_customer_limit: p.per_customer_limit ?? null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
})
const pack = (promotion: Promotion, targets: PromotionTarget[] = [], eligibility: PromotionEligibility[] = []): PromoWithMeta =>
  ({ promotion, targets, eligibility })

describe('promotion rule engine', () => {
  it('percentage applies to full cart subtotal', () => {
    const r = evaluatePromotions([pack(P({ code: 'P10', kind: 'percentage', config: { percent: 10 } }))], {
      cart: [{ productId: 'a', qty: 2, unitPrice: 50 }],
    })
    expect(r.subtotal).toBe(100)
    expect(r.discountTotal).toBe(10)
    expect(r.finalTotal).toBe(90)
  })

  it('fixed discount respects max_discount cap', () => {
    const r = evaluatePromotions([pack(P({ code: 'F', kind: 'fixed', config: { amount: 200 }, max_discount: 50 }))], {
      cart: [{ productId: 'a', qty: 1, unitPrice: 300 }],
    })
    expect(r.discountTotal).toBe(50)
  })

  it('skips when subtotal below min_spend', () => {
    const r = evaluatePromotions([pack(P({ code: 'M', kind: 'percentage', config: { percent: 20 }, min_spend: 500 }))], {
      cart: [{ productId: 'a', qty: 1, unitPrice: 100 }],
    })
    expect(r.discountTotal).toBe(0)
    expect(r.skipped[0].reason).toBe('below_min_spend')
  })

  it('bogo discounts cheapest units in buy+get groups', () => {
    // qty=4, 100 each; buy1+get1 → 2 groups → 2 free units of 100 each = 200
    const r = evaluatePromotions([pack(P({ code: 'B', kind: 'bogo', config: { buy: 1, get: 1, discount_percent: 100 } }))], {
      cart: [{ productId: 'a', qty: 4, unitPrice: 100 }],
    })
    expect(r.discountTotal).toBe(200)
  })

  it('non-stackable stops after first application', () => {
    const r = evaluatePromotions([
      pack(P({ code: 'A', kind: 'percentage', config: { percent: 10 }, priority: 1 })),
      pack(P({ code: 'B', kind: 'fixed', config: { amount: 5 }, priority: 2 })),
    ], { cart: [{ productId: 'x', qty: 1, unitPrice: 100 }] })
    expect(r.applied).toHaveLength(1)
    expect(r.applied[0].code).toBe('A')
    expect((r.skipped.find((s) => s.code === 'B') ?? { reason: '' }).reason).toBe('not_stackable')
  })

  it('stackable promotions stack in priority order', () => {
    const r = evaluatePromotions([
      pack(P({ code: 'A', kind: 'percentage', config: { percent: 10 }, priority: 1, stackable: true })),
      pack(P({ code: 'B', kind: 'fixed', config: { amount: 5 }, priority: 2, stackable: true })),
    ], { cart: [{ productId: 'x', qty: 1, unitPrice: 100 }] })
    expect(r.applied).toHaveLength(2)
    expect(r.discountTotal).toBe(15)
  })

  it('include targets filter cart lines', () => {
    const promo = P({ code: 'CAT', kind: 'percentage', config: { percent: 20 } })
    const targets: PromotionTarget[] = [{ id: 't1', promotion_id: promo.id, target_kind: 'include', entity_kind: 'category', entity_ref: 'vitamins' }]
    const r = evaluatePromotions([pack(promo, targets)], {
      cart: [
        { productId: 'a', qty: 1, unitPrice: 100, category: 'vitamins' },
        { productId: 'b', qty: 1, unitPrice: 100, category: 'other' },
      ],
    })
    expect(r.discountTotal).toBe(20)
  })

  it('exclude targets skip specific items', () => {
    const promo = P({ code: 'EX', kind: 'percentage', config: { percent: 50 } })
    const targets: PromotionTarget[] = [{ id: 't1', promotion_id: promo.id, target_kind: 'exclude', entity_kind: 'product', entity_ref: 'sensitive' }]
    const r = evaluatePromotions([pack(promo, targets)], {
      cart: [
        { productId: 'sensitive', qty: 1, unitPrice: 100 },
        { productId: 'other', qty: 1, unitPrice: 100 },
      ],
    })
    // Only "other" qualifies → 50% of 100 = 50. Applied to running subtotal (200).
    expect(r.discountTotal).toBe(50)
  })

  it('first_purchase eligibility blocks non-new customers', () => {
    const promo = P({ code: 'NEW', kind: 'fixed', config: { amount: 25 } })
    const el: PromotionEligibility[] = [{ id: 'e', promotion_id: promo.id, kind: 'first_purchase', value: null }]
    const returning = evaluatePromotions([pack(promo, [], el)], { cart: [{ productId: 'a', qty: 1, unitPrice: 100 }] })
    expect(returning.discountTotal).toBe(0)
    const newCust = evaluatePromotions([pack(promo, [], el)], { cart: [{ productId: 'a', qty: 1, unitPrice: 100 }], isFirstPurchase: true })
    expect(newCust.discountTotal).toBe(25)
  })

  it('expired promotions are skipped', () => {
    const r = evaluatePromotions([pack(P({ code: 'X', kind: 'fixed', config: { amount: 10 }, expires_at: '2000-01-01T00:00:00Z' }))], {
      cart: [{ productId: 'a', qty: 1, unitPrice: 100 }],
    })
    expect(r.skipped[0].reason).toBe('out_of_window')
    expect(r.discountTotal).toBe(0)
  })

  it('exhausted promotions are skipped', () => {
    const r = evaluatePromotions([pack(P({ code: 'U', kind: 'fixed', config: { amount: 10 }, usage_limit: 5, usage_count: 5 }))], {
      cart: [{ productId: 'a', qty: 1, unitPrice: 100 }],
    })
    expect(r.skipped[0].reason).toBe('exhausted')
  })

  it('tier_discount requires matching loyalty tier', () => {
    const promo = P({ code: 'TIER', kind: 'tier_discount', config: { tier: 'gold', percent: 5 } })
    const gold = evaluatePromotions([pack(promo)], { cart: [{ productId: 'a', qty: 1, unitPrice: 200 }], loyaltyTier: 'gold' })
    const silver = evaluatePromotions([pack(promo)], { cart: [{ productId: 'a', qty: 1, unitPrice: 200 }], loyaltyTier: 'silver' })
    expect(gold.discountTotal).toBe(10)
    expect(silver.discountTotal).toBe(0)
  })
})
