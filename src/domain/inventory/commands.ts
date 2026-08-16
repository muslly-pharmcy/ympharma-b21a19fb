import { z } from 'zod'

const uuid = z.string().uuid()
const idem = z.object({
  idempotencyKey: z.string().min(8).max(128).optional(),
  correlationId: z.string().min(4).max(128).optional(),
})

export const createWarehouseInput = idem.extend({
  organizationId: uuid,
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  kind: z.enum(['central', 'branch', 'transit', 'virtual']).default('central'),
  branch_id: uuid.optional().nullable(),
  address: z.string().max(500).optional().nullable(),
})
export type CreateWarehouseInput = z.infer<typeof createWarehouseInput>

export const updateWarehouseInput = idem.extend({
  id: uuid,
  patch: z.object({
    name: z.string().min(1).max(120).optional(),
    address: z.string().max(500).nullable().optional(),
    is_active: z.boolean().optional(),
  }),
})
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseInput>

export const receiveStockInput = idem.extend({
  organizationId: uuid,
  warehouseId: uuid,
  productId: uuid,
  supplierId: uuid.optional().nullable(),
  qty: z.number().positive(),
  cost: z.number().nonnegative().default(0),
  batchNo: z.string().max(60).optional().nullable(),
  expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
})
export type ReceiveStockInput = z.infer<typeof receiveStockInput>

export const adjustStockInput = idem.extend({
  batchId: uuid,
  delta: z.number(),
  reason: z.string().min(2).max(200),
})
export type AdjustStockInput = z.infer<typeof adjustStockInput>

export const transferStockInput = idem.extend({
  organizationId: uuid,
  fromWarehouseId: uuid,
  toWarehouseId: uuid,
  productId: uuid,
  qty: z.number().positive(),
})
export type TransferStockInput = z.infer<typeof transferStockInput>

export const reserveStockInput = idem.extend({
  organizationId: uuid,
  productId: uuid,
  qty: z.number().positive(),
  refType: z.string().max(40).optional().nullable(),
  refId: uuid.optional().nullable(),
  allowPartial: z.boolean().default(false),
})
export type ReserveStockInput = z.infer<typeof reserveStockInput>

export const reservationIdInput = idem.extend({ reservationId: uuid })
export type ReservationIdInput = z.infer<typeof reservationIdInput>

export const returnStockInput = idem.extend({
  organizationId: uuid,
  warehouseId: uuid,
  productId: uuid,
  qty: z.number().positive(),
  reason: z.string().max(200).optional().nullable(),
})
export type ReturnStockInput = z.infer<typeof returnStockInput>
