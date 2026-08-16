import { z } from 'zod'

const uuid = z.string().uuid()
const idem = z.object({
  idempotencyKey: z.string().min(8).max(128).optional(),
  correlationId: z.string().min(4).max(128).optional(),
})

export const createDispenseInput = idem.extend({
  organizationId: uuid,
  prescriptionId: uuid,
  notes: z.string().max(2000).optional().nullable(),
})
export type CreateDispenseInput = z.infer<typeof createDispenseInput>

export const dispenseIdInput = idem.extend({ dispenseId: uuid })
export type DispenseIdInput = z.infer<typeof dispenseIdInput>

export const verifyBarcodeInput = idem.extend({
  dispenseItemId: uuid,
  barcodeValue: z.string().min(1).max(200),
})
export type VerifyBarcodeInput = z.infer<typeof verifyBarcodeInput>

export const cancelDispenseInput = idem.extend({
  dispenseId: uuid,
  reason: z.string().min(2).max(500),
})
export type CancelDispenseInput = z.infer<typeof cancelDispenseInput>

export const returnDispenseInput = idem.extend({
  dispenseId: uuid,
  dispenseItemId: uuid.optional().nullable(),
  qty: z.number().positive(),
  reason: z.string().min(2).max(500),
})
export type ReturnDispenseInput = z.infer<typeof returnDispenseInput>
