// Billing entries are not general-ledger revenue or profit.
// Keep this formatting/period logic separate from the server function for tests.
export type BillingPeriod = 'day' | 'week' | 'month' | 'year'
export type BillingEntryType = 'charge' | 'refund' | 'credit' | 'adjustment'

const ADEN_OFFSET_MS = 3 * 60 * 60 * 1000

/** The beginning of the requested calendar period in Asia/Aden (UTC+03:00). */
export function getBillingPeriodStart(period: BillingPeriod, now = new Date()): string {
  const local = new Date(now.getTime() + ADEN_OFFSET_MS)
  const start = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()))

  if (period === 'week') {
    const daysSinceMonday = (start.getUTCDay() + 6) % 7
    start.setUTCDate(start.getUTCDate() - daysSinceMonday)
  } else if (period === 'month') {
    start.setUTCDate(1)
  } else if (period === 'year') {
    start.setUTCMonth(0, 1)
  }
  return new Date(start.getTime() - ADEN_OFFSET_MS).toISOString()
}

/** Formats an already-serialized NUMERIC amount without floating-point arithmetic. */
export function formatYerAmount(amount: string): string {
  const match = /^(-?)(\d+)(?:\.(\d{1,4}))?$/.exec(amount)
  if (!match) return '—'
  const integer = match[2].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const fractional = (match[3] ?? '').replace(/0+$/, '')
  return `${match[1]}${integer}${fractional ? '.' + fractional : ''}`
}
