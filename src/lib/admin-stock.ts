import { z } from 'zod'

export const stockSetInput = z.object({
  productId: z.string().uuid(),
  expectedBalance: z.number().finite().nonnegative().max(99_999_999_999),
  newBalance: z.number().int().nonnegative().max(99_999_999_999),
  idempotencyKey: z.string().uuid(),
  reason: z.string().trim().min(2).max(200),
})
export type StockSetInput = z.infer<typeof stockSetInput>

