import { z } from 'zod'

const uuid = z.string().uuid()
const idem = z.object({
  idempotencyKey: z.string().min(8).max(128).optional(),
  correlationId: z.string().min(4).max(128).optional(),
})

export const createPurchaseOrderInput = idem.extend({
  organizationId: uuid,
  supplierId: uuid,
  warehouseId: uuid,
  code: z.string().min(1).max(60),
  currency: z.string().length(3).default('SAR'),
  notes: z.string().max(2000).optional().nullable(),
  lines: z
    .array(
      z.object({
        product_id: uuid,
        qty_ordered: z.number().positive(),
        unit_cost: z.number().nonnegative().default(0),
        batch_no: z.string().max(60).optional().nullable(),
        expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
      }),
    )
    .min(1),
})
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderInput>

export const updatePurchaseOrderInput = idem.extend({
  id: uuid,
  patch: z.object({
    notes: z.string().max(2000).nullable().optional(),
    currency: z.string().length(3).optional(),
  }),
})
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderInput>

export const purchaseOrderIdInput = idem.extend({ id: uuid })
export type PurchaseOrderIdInput = z.infer<typeof purchaseOrderIdInput>
