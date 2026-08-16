import { describe, expect, it } from 'vitest'
import {
  ALLOWED_DISPENSE_TRANSITIONS,
  canTransitionDispense,
  type DispenseStatus,
} from '@/domain/dispenses/schemas'

describe('dispense state machine', () => {
  it('allows draft → prepared → verified → dispensed → completed', () => {
    expect(canTransitionDispense('draft', 'prepared')).toBe(true)
    expect(canTransitionDispense('prepared', 'verified')).toBe(true)
    expect(canTransitionDispense('verified', 'dispensed')).toBe(true)
    expect(canTransitionDispense('dispensed', 'completed')).toBe(true)
  })

  it('allows dispensed and completed to return', () => {
    expect(canTransitionDispense('dispensed', 'returned')).toBe(true)
    expect(canTransitionDispense('completed', 'returned')).toBe(true)
  })

  it('allows cancel from draft/prepared/verified only', () => {
    expect(canTransitionDispense('draft', 'cancelled')).toBe(true)
    expect(canTransitionDispense('prepared', 'cancelled')).toBe(true)
    expect(canTransitionDispense('verified', 'cancelled')).toBe(true)
    expect(canTransitionDispense('dispensed', 'cancelled')).toBe(false)
    expect(canTransitionDispense('completed', 'cancelled')).toBe(false)
  })

  it('returned and cancelled are terminal', () => {
    expect(ALLOWED_DISPENSE_TRANSITIONS.returned).toEqual([])
    expect(ALLOWED_DISPENSE_TRANSITIONS.cancelled).toEqual([])
  })

  it('rejects illegal jumps (draft → dispensed)', () => {
    expect(canTransitionDispense('draft', 'dispensed')).toBe(false)
    expect(canTransitionDispense('prepared', 'dispensed')).toBe(false)
  })

  it('every status is present in the transition map', () => {
    const statuses: DispenseStatus[] = ['draft','prepared','verified','dispensed','completed','returned','cancelled']
    for (const s of statuses) expect(ALLOWED_DISPENSE_TRANSITIONS[s]).toBeDefined()
  })
})
