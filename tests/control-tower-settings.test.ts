import { describe, expect, it } from 'vitest'
import {
  announcementSchema,
  asBoolean,
  asDeliveryMatrix,
  asPharmacyStatus,
  deliveryFeeSchema,
} from '../src/lib/control-tower/settings'

describe('delivery fee validation', () => {
  it('accepts non-negative integers', () => {
    expect(deliveryFeeSchema.safeParse(0).success).toBe(true)
    expect(deliveryFeeSchema.safeParse(1500).success).toBe(true)
  })

  it('rejects negative, decimal and non-finite values', () => {
    for (const bad of [-1, -0.5, 12.5, Number.NaN, Number.POSITIVE_INFINITY, 2_000_000]) {
      expect(deliveryFeeSchema.safeParse(bad).success).toBe(false)
    }
  })

  it('rejects non-numbers', () => {
    expect(deliveryFeeSchema.safeParse('100').success).toBe(false)
    expect(deliveryFeeSchema.safeParse(null).success).toBe(false)
  })
})

describe('jsonb coercion helpers', () => {
  it('falls back safely on malformed values', () => {
    expect(asBoolean(undefined, true)).toBe(true)
    expect(asBoolean('nope', false)).toBe(false)
    expect(asBoolean(true)).toBe(true)
    expect(asPharmacyStatus('WEIRD')).toBe('OPEN')
    expect(asPharmacyStatus('CLOSED')).toBe('CLOSED')
  })

  it('returns a zeroed matrix when the stored value is invalid', () => {
    const matrix = asDeliveryMatrix({ crater: -5 })
    expect(matrix['crater']).toBe(0)
    expect(Object.keys(matrix).length).toBeGreaterThan(0)
  })

  it('keeps a valid stored matrix', () => {
    expect(asDeliveryMatrix({ crater: 1000, mualla: 1200 })['mualla']).toBe(1200)
  })
})

describe('announcement schema', () => {
  it('rejects oversized text and unknown types', () => {
    expect(
      announcementSchema.safeParse({ active: true, text_ar: 'x'.repeat(501), type: 'info' }).success,
    ).toBe(false)
    expect(
      announcementSchema.safeParse({ active: true, text_ar: 'مرحبا', type: 'danger' }).success,
    ).toBe(false)
  })

  it('accepts a valid announcement', () => {
    expect(
      announcementSchema.safeParse({ active: true, text_ar: 'مرحبا', type: 'success' }).success,
    ).toBe(true)
  })
})
