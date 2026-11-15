import { describe, expect, it } from 'vitest'
import { formatYerAmount, getBillingPeriodStart } from '../src/lib/billing-display'

describe('YmPharma billing period boundaries (Asia/Aden)', () => {
  it('uses local midnight rather than UTC midnight', () => {
    expect(getBillingPeriodStart('day', new Date('2026-11-16T01:00:00Z'))).toBe('2026-11-15T21:00:00.000Z')
  })
  it('starts the week on Monday in Aden', () => {
    expect(getBillingPeriodStart('week', new Date('2026-11-16T01:00:00Z'))).toBe('2026-11-15T21:00:00.000Z')
    expect(getBillingPeriodStart('week', new Date('2026-11-15T20:00:00Z'))).toBe('2026-11-08T21:00:00.000Z')
  })
  it('uses the first day of month/year in Aden', () => {
    const now = new Date('2026-11-16T01:00:00Z')
    expect(getBillingPeriodStart('month', now)).toBe('2026-10-31T21:00:00.000Z')
    expect(getBillingPeriodStart('year', now)).toBe('2025-12-31T21:00:00.000Z')
  })
})

describe('display of NUMERIC(15,4) amounts without float arithmetic', () => {
  it('groups digits and preserves significant fractional digits', () => {
    expect(formatYerAmount('12345678901.2345')).toBe('12,345,678,901.2345')
    expect(formatYerAmount('-2500.5000')).toBe('-2,500.5')
    expect(formatYerAmount('0.0001')).toBe('0.0001')
  })
  it('does not display malformed values as money', () => {
    expect(formatYerAmount('oops')).toBe('—')
  })
})
