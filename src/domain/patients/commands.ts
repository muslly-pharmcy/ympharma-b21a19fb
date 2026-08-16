import { z } from 'zod'

const uuid = z.string().uuid()
const idem = z.object({
  idempotencyKey: z.string().min(8).max(128).optional(),
  correlationId: z.string().min(4).max(128).optional(),
})

export const createPatientInput = idem.extend({
  organizationId: uuid,
  full_name: z.string().min(2).max(200),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
  date_of_birth: z.string().date().optional().nullable(),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  blood_type: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional().nullable(),
  metadata: z.record(z.string(), z.any()).default({}),
})
export type CreatePatientInput = z.infer<typeof createPatientInput>

export const updatePatientInput = idem.extend({
  id: uuid,
  patch: z.object({
    full_name: z.string().min(2).max(200).optional(),
    phone: z.string().max(40).nullable().optional(),
    email: z.string().email().max(200).nullable().optional(),
    date_of_birth: z.string().date().nullable().optional(),
    gender: z.enum(['male', 'female', 'other']).nullable().optional(),
    blood_type: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).nullable().optional(),
    is_active: z.boolean().optional(),
  }),
})
export type UpdatePatientInput = z.infer<typeof updatePatientInput>

export const addAllergyInput = idem.extend({
  patientId: uuid,
  allergen: z.string().min(1).max(200),
  severity: z.enum(['mild', 'moderate', 'severe', 'life_threatening']).default('moderate'),
  reaction: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})
export type AddAllergyInput = z.infer<typeof addAllergyInput>

export const addConditionInput = idem.extend({
  patientId: uuid,
  condition_name: z.string().min(1).max(200),
  icd10: z.string().max(20).optional().nullable(),
  status: z.enum(['active', 'resolved', 'remission', 'chronic']).default('active'),
  onset_date: z.string().date().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})
export type AddConditionInput = z.infer<typeof addConditionInput>

export const addEmergencyContactInput = idem.extend({
  patientId: uuid,
  name: z.string().min(1).max(200),
  relation: z.string().max(60).optional().nullable(),
  phone: z.string().min(4).max(40),
  is_primary: z.boolean().default(false),
})
export type AddEmergencyContactInput = z.infer<typeof addEmergencyContactInput>

export const mergePatientsInput = idem.extend({
  sourceId: uuid,
  targetId: uuid,
})
export type MergePatientsInput = z.infer<typeof mergePatientsInput>
