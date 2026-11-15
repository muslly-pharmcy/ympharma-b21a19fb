import { describe, expect, it } from 'vitest'
import { billingEntry, billingWindow } from '@/lib/billing-ledger'

describe('billing calendar and schema', () => {
  it('uses Aden midnight rather than the host timezone', () => {
    expect(billingWindow('day', new Date('2026-11-15T22:00:00Z'))).toEqual({
      from: '2026-11-15T21:00:00.000Z', to: '2026-11-16T21:00:00.000Z',
    })
  })
  it('starts the week on Saturday across the year boundary', () => {
    expect(billingWindow('week', new Date('2027-01-01T10:00:00Z'))).toEqual({
      from: '2026-12-25T21:00:00.000Z', to: '2027-01-01T21:00:00.000Z',
    })
  })
  it('handles a leap-year month', () => {
    expect(billingWindow('month', new Date('2028-02-15T10:00:00Z'))).toEqual({
      from: '2028-01-31T21:00:00.000Z', to: '2028-02-29T21:00:00.000Z',
    })
  })
  it('bounds the complete calendar year', () => {
    expect(billingWindow('year', new Date('2026-11-16T10:00:00Z'))).toEqual({
      from: '2025-12-31T21:00:00.000Z', to: '2026-12-31T21:00:00.000Z',
    })
  })
  const row = { id: 'synthetic', entry_type: 'charge', amount_yer: '12345678901.2345', notes: null, created_at: '2026-11-16T00:00:00+00:00' }
  it('preserves decimal text without converting to cents or classifying profit', () => {
    expect(billingEntry.parse(row).amount_yer).toBe('12345678901.2345')
    expect(billingEntry.parse({ ...row, amount_yer: 12.25 }).amount_yer).toBe('12.25')
  })
  it.each([null, 'NaN', '1e9', Infinity, '0.12345'])('rejects malformed amounts: %s', (amount_yer) => {
    expect(billingEntry.safeParse({ ...row, amount_yer }).success).toBe(false)
  })
  it('rejects unknown entry types instead of guessing transfer', () => {
    expect(billingEntry.safeParse({ ...row, entry_type: 'unknown' }).success).toBe(false)
  })
})
