import { z } from 'zod'

const uuid = z.string().uuid()
const idem = z.object({
  idempotencyKey: z.string().min(8).max(128).optional(),
  correlationId: z.string().min(4).max(128).optional(),
})

export const createProductInput = idem.extend({
  organizationId: uuid,
  name_ar: z.string().min(1).max(200),
  name_en: z.string().max(200).optional().nullable(),
  category_id: uuid.optional().nullable(),
  brand: z.string().max(120).optional().nullable(),
  manufacturer: z.string().max(120).optional().nullable(),
  dosage_form: z.string().max(60).optional().nullable(),
  strength: z.string().max(60).optional().nullable(),
  description_ar: z.string().max(2000).optional().nullable(),
})
export type CreateProductInput = z.infer<typeof createProductInput>

export const updateProductInput = idem.extend({
  id: uuid,
  patch: createProductInput.omit({ organizationId: true, idempotencyKey: true, correlationId: true }).partial(),
})
export type UpdateProductInput = z.infer<typeof updateProductInput>

export const archiveProductInput = idem.extend({ id: uuid })
export type ArchiveProductInput = z.infer<typeof archiveProductInput>
