import { describe, it, expect } from 'vitest'
import {
  issuePointsInput, redeemPointsInput, adjustPointsInput,
  createRewardInput, redeemRewardInput, upsertRuleInput,
} from '@/domain/loyalty/commands'

const C = '11111111-1111-4111-8111-111111111111'
const R = '22222222-2222-4222-8222-222222222222'

describe('loyalty command schemas', () => {
  it('issue requires points or computeFromRules', () => {
    expect(() => issuePointsInput.parse({ customerId: C, idempotencyKey: 'idem-1234' })).toThrow()
    expect(issuePointsInput.parse({ customerId: C, points: 10, idempotencyKey: 'idem-1234' }).points).toBe(10)
    expect(issuePointsInput.parse({ customerId: C, computeFromRules: true, idempotencyKey: 'idem-1234' }).computeFromRules).toBe(true)
  })

  it('redeem rejects non-positive points', () => {
    expect(() => redeemPointsInput.parse({ customerId: C, points: 0, idempotencyKey: 'idem-1234' })).toThrow()
    expect(() => redeemPointsInput.parse({ customerId: C, points: -5, idempotencyKey: 'idem-1234' })).toThrow()
    expect(redeemPointsInput.parse({ customerId: C, points: 5, idempotencyKey: 'idem-1234' }).points).toBe(5)
  })

  it('adjust rejects zero and requires reason', () => {
    expect(() => adjustPointsInput.parse({ customerId: C, points: 0, reason: 'x', idempotencyKey: 'idem-1234' })).toThrow()
    expect(() => adjustPointsInput.parse({ customerId: C, points: 5, idempotencyKey: 'idem-1234' })).toThrow()
    expect(adjustPointsInput.parse({ customerId: C, points: -5, reason: 'correction', idempotencyKey: 'idem-1234' }).points).toBe(-5)
  })

  it('reward requires positive cost', () => {
    expect(() => createRewardInput.parse({ code: 'X', name: 'X', points_cost: 0 })).toThrow()
    expect(createRewardInput.parse({ code: 'CUP', name: 'Free cup', points_cost: 100 }).points_cost).toBe(100)
  })

  it('reward redeem parses uuids', () => {
    expect(redeemRewardInput.parse({ rewardId: R, customerId: C, idempotencyKey: 'idem-1234' }).rewardId).toBe(R)
  })

  it('rule enforces kind enum', () => {
    expect(() => upsertRuleInput.parse({ key: 'rule-key', name: 'Rule name', kind: 'nope', config: {} })).toThrow()
    expect(upsertRuleInput.parse({ key: 'rule-key', name: 'Rule name', kind: 'spend_earn', config: { per_currency_unit: 10 } }).kind).toBe('spend_earn')
  })
})
