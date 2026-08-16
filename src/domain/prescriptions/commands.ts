import { z } from 'zod'

const uuid = z.string().uuid()

export const prescriptionItemInput = z.object({
  product_id: uuid.nullable().optional(),
  medication_name: z.string().min(1).max(200),
  strength: z.string().max(80).nullable().optional(),
  form: z.string().max(80).nullable().optional(),
  dose: z.string().max(120).nullable().optional(),
  frequency: z.string().max(120).nullable().optional(),
  duration_days: z.number().int().positive().max(3650).nullable().optional(),
  quantity: z.number().positive().max(100000).default(1),
  route: z.string().max(80).nullable().optional(),
  instructions: z.string().max(1000).nullable().optional(),
})
export type PrescriptionItemInput = z.infer<typeof prescriptionItemInput>

export const createPrescriptionInput = z.object({
  organizationId: uuid,
  patient_id: uuid,
  doctor_id: uuid.nullable().optional(),
  external_doctor_name: z.string().max(200).nullable().optional(),
  prescription_no: z.string().max(80).nullable().optional(),
  issued_at: z.string().datetime().optional(),
  diagnosis: z.string().max(2000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  items: z.array(prescriptionItemInput).default([]),
  idempotencyKey: z.string().optional(),
  correlationId: z.string().optional(),
})
export type CreatePrescriptionInput = z.infer<typeof createPrescriptionInput>

export const updatePrescriptionInput = z.object({
  id: uuid,
  patch: z.object({
    doctor_id: uuid.nullable().optional(),
    external_doctor_name: z.string().max(200).nullable().optional(),
    prescription_no: z.string().max(80).nullable().optional(),
    issued_at: z.string().datetime().optional(),
    diagnosis: z.string().max(2000).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  }),
  correlationId: z.string().optional(),
})
export type UpdatePrescriptionInput = z.infer<typeof updatePrescriptionInput>

export const addItemInput = z.object({
  prescriptionId: uuid,
  item: prescriptionItemInput,
})
export type AddItemInput = z.infer<typeof addItemInput>

export const removeItemInput = z.object({
  prescriptionId: uuid,
  itemId: uuid,
})
export type RemoveItemInput = z.infer<typeof removeItemInput>

export const transitionInput = z.object({
  prescriptionId: uuid,
  to: z.enum(['submitted', 'validated', 'approved', 'cancelled']),
  reason: z.string().max(500).nullable().optional(),
  correlationId: z.string().optional(),
})
export type TransitionInput = z.infer<typeof transitionInput>

export const addNoteInput = z.object({
  prescriptionId: uuid,
  body: z.string().min(1).max(2000),
})
export type AddNoteInput = z.infer<typeof addNoteInput>
