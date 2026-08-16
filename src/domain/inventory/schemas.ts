import { z } from 'zod'

export const stockBatchSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  location_id: z.string().uuid().nullable(),
  product_id: z.string().uuid(),
  supplier_id: z.string().uuid().nullable(),
  batch_no: z.string().nullable(),
  expiry_date: z.string().nullable(),
  qty_on_hand: z.number(),
  qty_reserved: z.number(),
  cost: z.number().nullable(),
  selling_price: z.number().nullable(),
  received_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type StockBatch = z.infer<typeof stockBatchSchema>

export const warehouseSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  branch_id: z.string().uuid().nullable(),
  code: z.string(),
  name: z.string(),
  kind: z.string(),
  address: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type Warehouse = z.infer<typeof warehouseSchema>

export interface StockSummary {
  productId: string
  totalOnHand: number
  totalReserved: number
  batches: number
  nearestExpiry: string | null
}
