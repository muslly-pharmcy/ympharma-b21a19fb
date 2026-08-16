import { describe, it, expect } from 'vitest'
import { combineSets } from '@/lib/segments/engine.server'
import { isLegalTransition, segmentRule, segmentRulesArray } from '@/domain/crm/segment-dsl'

describe('segment engine — pure combinators', () => {
  it('intersects (AND)', () => {
    const a = new Set(['x','y','z'])
    const b = new Set(['y','z','q'])
    expect([...combineSets([a,b], 'and')].sort()).toEqual(['y','z'])
  })
  it('unions (OR)', () => {
    const a = new Set(['x','y'])
    const b = new Set(['y','z'])
    expect([...combineSets([a,b], 'or')].sort()).toEqual(['x','y','z'])
  })
  it('returns empty set on empty inputs', () => {
    expect(combineSets([], 'and').size).toBe(0)
  })
})

describe('segment rule DSL', () => {
  it('parses supported ops', () => {
    expect(segmentRule.parse({ op: 'is_new_within_days', days: 30 }).op).toBe('is_new_within_days')
    expect(segmentRule.parse({ op: 'min_points_balance', value: 100 }).op).toBe('min_points_balance')
    expect(segmentRule.parse({ op: 'loyalty_tier_code', value: 'GOLD' }).op).toBe('loyalty_tier_code')
  })
  it('rejects unknown ops', () => {
    expect(() => segmentRule.parse({ op: 'nope', value: 1 })).toThrow()
  })
  it('caps rule list at 20', () => {
    const many = Array.from({ length: 21 }, () => ({ op: 'is_new_within_days' as const, days: 1 }))
    expect(() => segmentRulesArray.parse(many)).toThrow()
  })
})

describe('campaign state machine', () => {
  it('allows draft -> scheduled', () => expect(isLegalTransition('draft','scheduled')).toBe(true))
  it('allows scheduled -> running', () => expect(isLegalTransition('scheduled','running')).toBe(true))
  it('allows running -> paused', () => expect(isLegalTransition('running','paused')).toBe(true))
  it('allows paused -> running', () => expect(isLegalTransition('paused','running')).toBe(true))
  it('rejects completed -> anything', () => {
    expect(isLegalTransition('completed','running')).toBe(false)
    expect(isLegalTransition('completed','draft')).toBe(false)
  })
  it('rejects cancelled -> anything', () => {
    expect(isLegalTransition('cancelled','running')).toBe(false)
  })
  it('rejects draft -> paused', () => expect(isLegalTransition('draft','paused')).toBe(false))
})
