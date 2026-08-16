import { z } from 'zod'

const uuid = z.string().uuid()
const idem = z.object({
  idempotencyKey: z.string().min(8).max(128).optional(),
  correlationId: z.string().min(4).max(128).optional(),
})

export const createSupplierInput = idem.extend({
  organizationId: uuid,
  code: z.string().max(40).optional().nullable(),
  name: z.string().min(1).max(200),
  legal_name: z.string().max(200).optional().nullable(),
  tax_id: z.string().max(60).optional().nullable(),
  contact: z.record(z.string(), z.any()).default({}),
})
export type CreateSupplierInput = z.infer<typeof createSupplierInput>

export const updateSupplierInput = idem.extend({
  id: uuid,
  patch: z.object({
    name: z.string().min(1).max(200).optional(),
    legal_name: z.string().max(200).nullable().optional(),
    tax_id: z.string().max(60).nullable().optional(),
    contact: z.record(z.string(), z.any()).optional(),
    status: z.enum(['active', 'inactive', 'suspended']).optional(),
  }),
})
export type UpdateSupplierInput = z.infer<typeof updateSupplierInput>
