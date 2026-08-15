/**
 * Phone normalization used by the phone/OTP registration path.
 * Deliverability stays the provider's responsibility — this only guards format.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_COUNTRY_CODE,
  isValidPhone,
  looksLikeEmail,
  normalizePhone,
  toAsciiDigits,
} from '@/lib/auth/phone'

describe('toAsciiDigits', () => {
  it('converts Arabic-Indic and extended Arabic digits', () => {
    expect(toAsciiDigits('٧٧٧١٢٣٤٥٦')).toBe('777123456')
    expect(toAsciiDigits('۷۷۷۱۲۳۴۵۶')).toBe('777123456')
  })
})

describe('normalizePhone', () => {
  it('normalizes Yemeni local formats to E.164', () => {
    expect(normalizePhone('777123456')).toBe('+967777123456')
    expect(normalizePhone('0777123456')).toBe('+967777123456')
    expect(normalizePhone('777 123 456')).toBe('+967777123456')
    expect(normalizePhone('777-123-456')).toBe('+967777123456')
    expect(normalizePhone('٧٧٧١٢٣٤٥٦')).toBe('+967777123456')
  })

  it('keeps explicit international input', () => {
    expect(normalizePhone('+967777123456')).toBe('+967777123456')
    expect(normalizePhone('00967777123456')).toBe('+967777123456')
    expect(normalizePhone('+14155552671')).toBe('+14155552671')
  })

  it('uses the default country code constant', () => {
    expect(normalizePhone('777123456')).toBe(`+${DEFAULT_COUNTRY_CODE}777123456`)
  })

  it('rejects invalid input', () => {
    for (const raw of ['', '   ', 'abc', '123', '+', 'محمد', '12345678901234567890']) {
      expect(normalizePhone(raw)).toBeNull()
    }
  })

  it('isValidPhone mirrors normalizePhone', () => {
    expect(isValidPhone('777123456')).toBe(true)
    expect(isValidPhone('123')).toBe(false)
  })
})

describe('looksLikeEmail', () => {
  it('routes identifiers between the email and phone flows', () => {
    expect(looksLikeEmail('patient@muslly.com')).toBe(true)
    expect(looksLikeEmail('777123456')).toBe(false)
  })
})
