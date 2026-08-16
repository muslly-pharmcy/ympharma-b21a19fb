import { describe, it, expect } from 'vitest'
import {
  ALLOWED_TRANSITIONS, canTransition, type PrescriptionStatus,
} from '@/domain/prescriptions/schemas'
import {
  createPrescriptionInput, transitionInput, prescriptionItemInput,
} from '@/domain/prescriptions/commands'

describe('prescription state machine', () => {
  it('allows the happy path draft → submitted → validated → approved', () => {
    expect(canTransition('draft', 'submitted')).toBe(true)
    expect(canTransition('submitted', 'validated')).toBe(true)
    expect(canTransition('validated', 'approved')).toBe(true)
  })

  it('allows cancellation from any active state', () => {
    (['draft', 'submitted', 'validated', 'approved'] as PrescriptionStatus[]).forEach((s) => {
      expect(canTransition(s, 'cancelled')).toBe(true)
    })
  })

  it('rejects backwards transitions', () => {
    expect(canTransition('submitted', 'draft')).toBe(false)
    expect(canTransition('validated', 'submitted')).toBe(false)
    expect(canTransition('approved', 'validated')).toBe(false)
  })

  it('cancelled is terminal', () => {
    expect(ALLOWED_TRANSITIONS.cancelled).toEqual([])
    expect(canTransition('cancelled', 'draft')).toBe(false)
    expect(canTransition('cancelled', 'approved')).toBe(false)
  })

  it('cannot skip states', () => {
    expect(canTransition('draft', 'validated')).toBe(false)
    expect(canTransition('draft', 'approved')).toBe(false)
    expect(canTransition('submitted', 'approved')).toBe(false)
  })
})

describe('prescription input schemas', () => {
  const orgId = '11111111-1111-4111-8111-111111111111'
  const patId = '22222222-2222-4222-8222-222222222222'

  it('accepts a minimal create payload', () => {
    const parsed = createPrescriptionInput.parse({
      organizationId: orgId, patient_id: patId,
    })
    expect(parsed.items).toEqual([])
  })

  it('validates item quantities and required medication_name', () => {
    expect(() => prescriptionItemInput.parse({ medication_name: '', quantity: 1 })).toThrow()
    expect(() => prescriptionItemInput.parse({ medication_name: 'X', quantity: -1 })).toThrow()
    const ok = prescriptionItemInput.parse({ medication_name: 'Amoxicillin', quantity: 30 })
    expect(ok.medication_name).toBe('Amoxicillin')
  })

  it('rejects illegal transition targets at the schema layer', () => {
    expect(() => transitionInput.parse({
      prescriptionId: patId, to: 'draft',
    })).toThrow()
    const ok = transitionInput.parse({ prescriptionId: patId, to: 'submitted' })
    expect(ok.to).toBe('submitted')
  })
})
