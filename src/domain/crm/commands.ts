import { z } from 'zod'

export const createCustomerInput = z.object({
  full_name: z.string().trim().min(2).max(200),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(200).optional().nullable(),
  patient_id: z.string().uuid().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z.string().min(6).max(120),
  correlationId: z.string().optional(),
})
export type CreateCustomerInput = z.infer<typeof createCustomerInput>

export const updateCustomerInput = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(200).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  email: z.string().trim().email().max(200).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(['active', 'archived']).optional(),
  patient_id: z.string().uuid().nullable().optional(),
  correlationId: z.string().optional(),
})
export type UpdateCustomerInput = z.infer<typeof updateCustomerInput>

export const mergeCustomersInput = z.object({
  targetId: z.string().uuid(),
  sourceId: z.string().uuid(),
  correlationId: z.string().optional(),
})
export type MergeCustomersInput = z.infer<typeof mergeCustomersInput>

export const addAddressInput = z.object({
  customerId: z.string().uuid(),
  kind: z.enum(['billing', 'shipping', 'other']).default('shipping'),
  line1: z.string().trim().min(2).max(200),
  line2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  region: z.string().trim().max(120).optional().nullable(),
  country: z.string().trim().max(120).optional().nullable(),
  postal_code: z.string().trim().max(30).optional().nullable(),
  is_default: z.boolean().optional(),
})
export type AddAddressInput = z.infer<typeof addAddressInput>

export const addContactInput = z.object({
  customerId: z.string().uuid(),
  kind: z.enum(['phone', 'email', 'whatsapp', 'other']),
  value: z.string().trim().min(2).max(200),
  label: z.string().trim().max(60).optional().nullable(),
  is_primary: z.boolean().optional(),
})
export type AddContactInput = z.infer<typeof addContactInput>

export const addTagInput = z.object({
  customerId: z.string().uuid(),
  tag: z.string().trim().min(1).max(60),
  color: z.string().trim().max(20).optional().nullable(),
})
export type AddTagInput = z.infer<typeof addTagInput>
