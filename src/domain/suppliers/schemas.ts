import { z } from 'zod'

export const supplierSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  code: z.string().nullable(),
  name: z.string(),
  legal_name: z.string().nullable(),
  tax_id: z.string().nullable(),
  contact: z.record(z.string(), z.any()).default({}),
  status: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type Supplier = z.infer<typeof supplierSchema>
