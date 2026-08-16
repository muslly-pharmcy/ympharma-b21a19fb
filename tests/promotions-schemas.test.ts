import { describe, it, expect } from 'vitest'
import {
  createPromotionInput, updatePromotionInput, transitionPromotionInput,
  createCouponInput, redeemCouponInput,
} from '@/domain/promotions/commands'

const U = '11111111-1111-4111-8111-111111111111'

describe('promotion command schemas', () => {
  it('createPromotion requires alphanumeric code and idempotency key', () => {
    expect(() => createPromotionInput.parse({ code: 'bad space', name: 'X', kind: 'percentage', idempotencyKey: 'abcdef' })).toThrow()
    expect(createPromotionInput.parse({ code: 'SUMMER10', name: 'Summer', kind: 'percentage', idempotencyKey: 'abcdef' }).code).toBe('SUMMER10')
  })

  it('createPromotion rejects unknown kind', () => {
    expect(() => createPromotionInput.parse({ code: 'X', name: 'Y', kind: 'weird', idempotencyKey: 'abcdef' })).toThrow()
  })

  it('updatePromotion requires uuid id and forbids code changes', () => {
    const parsed = updatePromotionInput.parse({ id: U, name: 'New name' })
    expect(parsed.name).toBe('New name')
    // @ts-expect-error code is not part of the update payload
    expect(parsed.code).toBeUndefined()
  })

  it('transition enum enforced', () => {
    expect(() => transitionPromotionInput.parse({ id: U, next: 'nope' })).toThrow()
    expect(transitionPromotionInput.parse({ id: U, next: 'active' }).next).toBe('active')
  })

  it('createCoupon requires at least one code', () => {
    expect(() => createCouponInput.parse({ name: 'XX', codes: [], idempotencyKey: 'abcdef' })).toThrow()
    const c = createCouponInput.parse({ name: 'XX', codes: [{ code: 'ABC10' }], idempotencyKey: 'abcdef' })
    expect(c.codes[0].code).toBe('ABC10')
    expect(c.mode).toBe('multi')
  })

  it('redeemCoupon requires non-negative discount and idem key', () => {
    expect(() => redeemCouponInput.parse({ code: 'ABC', discountAmount: -1, idempotencyKey: 'abcdef' })).toThrow()
    expect(redeemCouponInput.parse({ code: 'ABC', discountAmount: 25, idempotencyKey: 'abcdef' }).discountAmount).toBe(25)
  })
})
