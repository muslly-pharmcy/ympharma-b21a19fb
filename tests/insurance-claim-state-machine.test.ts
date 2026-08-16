import { describe, it, expect } from 'vitest'
import {
  ALLOWED_CLAIM_TRANSITIONS,
  canTransitionClaim,
  type ClaimStatus,
} from '@/domain/insurance/schemas'

describe('insurance claim state machine', () => {
  const allStatuses: ClaimStatus[] = [
    'draft', 'submitted', 'in_review', 'approved', 'partially_approved',
    'rejected', 'paid', 'closed', 'cancelled',
  ]

  it('allows draft → submitted / cancelled only', () => {
    expect(canTransitionClaim('draft', 'submitted')).toBe(true)
    expect(canTransitionClaim('draft', 'cancelled')).toBe(true)
    expect(canTransitionClaim('draft', 'approved')).toBe(false)
    expect(canTransitionClaim('draft', 'paid')).toBe(false)
  })

  it('allows submitted → in_review / approved / partially_approved / rejected / cancelled', () => {
    for (const to of ['in_review','approved','partially_approved','rejected','cancelled'] as ClaimStatus[]) {
      expect(canTransitionClaim('submitted', to)).toBe(true)
    }
    expect(canTransitionClaim('submitted', 'paid')).toBe(false)
    expect(canTransitionClaim('submitted', 'draft')).toBe(false)
  })

  it('routes approved / partially_approved to paid or closed', () => {
    for (const from of ['approved','partially_approved'] as ClaimStatus[]) {
      expect(canTransitionClaim(from, 'paid')).toBe(true)
      expect(canTransitionClaim(from, 'closed')).toBe(true)
      expect(canTransitionClaim(from, 'draft')).toBe(false)
    }
  })

  it('rejected only goes to closed', () => {
    expect(canTransitionClaim('rejected', 'closed')).toBe(true)
    expect(canTransitionClaim('rejected', 'paid')).toBe(false)
    expect(canTransitionClaim('rejected', 'approved')).toBe(false)
  })

  it('paid only closes', () => {
    expect(canTransitionClaim('paid', 'closed')).toBe(true)
    expect(canTransitionClaim('paid', 'rejected')).toBe(false)
  })

  it('terminal statuses cannot transition', () => {
    for (const from of ['closed','cancelled'] as ClaimStatus[]) {
      for (const to of allStatuses) {
        expect(canTransitionClaim(from, to)).toBe(false)
      }
    }
  })

  it('no status is missing from the transition table', () => {
    for (const s of allStatuses) {
      expect(ALLOWED_CLAIM_TRANSITIONS[s]).toBeDefined()
    }
  })
})
