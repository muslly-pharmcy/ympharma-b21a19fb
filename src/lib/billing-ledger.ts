import { z } from 'zod'

export const billingPeriod = z.enum(['day', 'week', 'month', 'year'])
export type BillingPeriod = z.infer<typeof billingPeriod>
export const billingEntry = z.object({
  id: z.string(),
  entry_type: z.enum(['charge', 'refund', 'credit', 'adjustment']),
  // Read-only display: preserve decimal strings and never infer income/profit.
  amount_yer: z.union([z.string(), z.number().finite()])
    .transform(String).pipe(z.string().regex(/^-?\d+(?:\.\d{1,4})?$/)),
  notes: z.string().nullable(),
  created_at: z.string().datetime({ offset: true }),
})
export type BillingEntry = z.infer<typeof billingEntry>

/** Calendar periods in Asia/Aden (UTC+3), with Saturday as the week start. */
export function billingWindow(period: BillingPeriod, now = new Date()) {
  const offset = 3 * 60 * 60 * 1000
  const local = new Date(now.getTime() + offset)
  const start = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()))
  const end = new Date(start)
  if (period === 'day') end.setUTCDate(end.getUTCDate() + 1)
  if (period === 'week') {
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 1) % 7))
    end.setTime(start.getTime())
    end.setUTCDate(end.getUTCDate() + 7)
  }
  if (period === 'month') {
    start.setUTCDate(1)
    end.setTime(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1))
  }
  if (period === 'year') {
    start.setTime(Date.UTC(local.getUTCFullYear(), 0, 1))
    end.setTime(Date.UTC(local.getUTCFullYear() + 1, 0, 1))
  }
  return { from: new Date(start.getTime() - offset).toISOString(), to: new Date(end.getTime() - offset).toISOString() }
}
