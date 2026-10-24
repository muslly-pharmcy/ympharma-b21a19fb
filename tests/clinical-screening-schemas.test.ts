import { describe, expect, it } from 'vitest'
import type { ClinicalWarning } from '@/domain/clinical/types'
import {
  confidenceFor,
  deterministicSummaryAr,
  highestSeverity,
  overrideScreeningInput,
  screeningInputHash,
} from '@/domain/clinical-screening/schemas'

function warning(overrides: Partial<ClinicalWarning> = {}): ClinicalWarning {
  return {
    category: 'interaction',
    severity: 'moderate',
    code: 'DDI-001',
    message: 'تنبيه تجريبي',
    source: 'local-db',
    ...overrides,
  }
}

describe('clinical screening domain helpers', () => {
  it('orders severities and ignores info-only noise', () => {
    expect(highestSeverity([])).toBeNull()
    expect(highestSeverity([warning({ severity: 'info' }), warning({ severity: 'high' })])).toBe('high')
    expect(
      highestSeverity([warning({ severity: 'low' }), warning({ severity: 'critical' }), warning({ severity: 'high' })]),
    ).toBe('critical')
  })

  it('derives confidence from the provider and patient profile completeness', () => {
    expect(confidenceFor('null', { hasPatientProfile: true })).toBe('unverified')
    expect(confidenceFor('', { hasPatientProfile: true })).toBe('unverified')
    expect(confidenceFor('local-db', { hasPatientProfile: false })).toBe('partial')
    expect(confidenceFor('local-db', { hasPatientProfile: true })).toBe('verified')
  })

  it('always produces a deterministic Arabic summary', () => {
    const empty = deterministicSummaryAr([])
    expect(empty.length).toBeGreaterThan(10)
    expect(empty).toContain('قاعدة المعرفة')

    const summary = deterministicSummaryAr([
      warning({ severity: 'critical' }),
      warning({ severity: 'high' }),
      warning({ severity: 'moderate' }),
    ])
    expect(summary).toContain('3')
    expect(summary).toContain('حرج')
  })

  it('hashes the exact drug set in a stable and order-sensitive way', () => {
    const a = screeningInputHash([{ name: 'Paracetamol', dose: '500mg', route: 'oral' }])
    const b = screeningInputHash([{ name: 'paracetamol ', dose: '500mg', route: 'oral' }])
    const c = screeningInputHash([
      { name: 'Paracetamol', dose: '500mg', route: 'oral' },
      { name: 'Warfarin', dose: '5mg', route: 'oral' },
    ])
    const reversed = screeningInputHash([
      { name: 'Warfarin', dose: '5mg', route: 'oral' },
      { name: 'Paracetamol', dose: '500mg', route: 'oral' },
    ])

    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(c).not.toBe(reversed)
    expect(a).toMatch(/^fnv1a-[0-9a-f]{8}-\d+$/)
  })

  it('rejects unsigned or weak override payloads', () => {
    expect(
      overrideScreeningInput.safeParse({
        dispenseId: '11111111-1111-4111-8111-111111111111',
        screeningId: '22222222-2222-4222-8222-222222222222',
        reason: 'short',
        acknowledge: true,
      }).success,
    ).toBe(false)

    expect(
      overrideScreeningInput.safeParse({
        dispenseId: '11111111-1111-4111-8111-111111111111',
        screeningId: '22222222-2222-4222-8222-222222222222',
        reason: 'راجعت التنبيه وقررت الصرف',
        acknowledge: false,
      }).success,
    ).toBe(false)

    expect(
      overrideScreeningInput.safeParse({
        dispenseId: '11111111-1111-4111-8111-111111111111',
        screeningId: '22222222-2222-4222-8222-222222222222',
        reason: 'راجعت التنبيه وقررت الصرف',
        acknowledge: true,
      }).success,
    ).toBe(true)
  })
})
