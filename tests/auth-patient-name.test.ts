/**
 * Three-part patient name (الاسم الثلاثي) — registration coverage.
 *
 * The name is profile data only: it is never a credential and never used to
 * find or merge an existing patient record.
 */
import { describe, expect, it } from 'vitest'
import {
  NAME_PART_MAX,
  buildFullName,
  isValidNamePart,
  normalizeNamePart,
  validateThreePartName,
} from '@/lib/auth/patient-name'

describe('normalizeNamePart', () => {
  it('trims and collapses whitespace, including RTL marks and nbsp', () => {
    expect(normalizeNamePart('  محمد  ')).toBe('محمد')
    expect(normalizeNamePart('محمد\u00a0\u200fعلي')).toBe('محمد علي')
  })

  it('never rewrites spelling or strips diacritics', () => {
    expect(normalizeNamePart('مُحَمَّد')).toBe('مُحَمَّد')
    expect(normalizeNamePart('إبراهيم')).toBe('إبراهيم')
  })
})

describe('isValidNamePart', () => {
  it('accepts Arabic, Latin and hyphenated names', () => {
    for (const part of ['محمد', 'المصلي', 'عبد الله', 'Mohammed', "D'Souza", 'Al-Muslly']) {
      expect(isValidNamePart(part)).toBe(true)
    }
  })

  it('rejects single letters, digits, symbols and empty input', () => {
    for (const part of ['م', '', '  ', '12345', 'محمد2', 'محمد@', '<script>']) {
      expect(isValidNamePart(part)).toBe(false)
    }
  })

  it('rejects parts longer than the maximum', () => {
    expect(isValidNamePart('م'.repeat(NAME_PART_MAX + 1))).toBe(false)
    expect(isValidNamePart('م'.repeat(NAME_PART_MAX))).toBe(true)
  })
})

describe('validateThreePartName', () => {
  it('accepts a complete Arabic three-part name and builds the full name', () => {
    const result = validateThreePartName({
      firstName: ' محمد ',
      fatherName: 'علي',
      familyName: 'المصلي',
    })
    expect(result.ok).toBe(true)
    expect(result.invalid).toEqual([])
    expect(result.fullName).toBe('محمد علي المصلي')
  })

  it('flags exactly the missing or invalid parts', () => {
    const missingFather = validateThreePartName({ firstName: 'محمد', familyName: 'المصلي' })
    expect(missingFather.ok).toBe(false)
    expect(missingFather.invalid).toEqual(['fatherName'])

    const empty = validateThreePartName({})
    expect(empty.ok).toBe(false)
    expect(empty.invalid).toEqual(['firstName', 'fatherName', 'familyName'])

    const shortFirst = validateThreePartName({
      firstName: 'م',
      fatherName: 'علي',
      familyName: 'المصلي',
    })
    expect(shortFirst.invalid).toEqual(['firstName'])
  })

  it('accepts Latin and mixed-script names', () => {
    expect(
      validateThreePartName({
        firstName: 'Mohammed',
        fatherName: 'علي',
        familyName: 'Almuslly',
      }).ok,
    ).toBe(true)
  })

  it('is pure — the input object is not mutated', () => {
    const input = { firstName: ' محمد ', fatherName: 'علي', familyName: 'المصلي' }
    validateThreePartName(input)
    expect(input.firstName).toBe(' محمد ')
  })
})

describe('buildFullName', () => {
  it('joins available parts and skips empty ones', () => {
    expect(buildFullName({ firstName: 'محمد', fatherName: '', familyName: 'المصلي' })).toBe(
      'محمد المصلي',
    )
    expect(buildFullName({})).toBe('')
  })
})
