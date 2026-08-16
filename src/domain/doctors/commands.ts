import { z } from 'zod'

const uuid = z.string().uuid()
const idem = z.object({
  idempotencyKey: z.string().min(8).max(128).optional(),
  correlationId: z.string().min(4).max(128).optional(),
})

export const createDoctorInput = idem.extend({
  organizationId: uuid,
  full_name_ar: z.string().min(2).max(200),
  full_name_en: z.string().max(200).optional().nullable(),
  title: z.string().max(60).optional().nullable(),
  bio_ar: z.string().max(2000).optional().nullable(),
  bio_en: z.string().max(2000).optional().nullable(),
  years_experience: z.number().int().min(0).max(80).optional().nullable(),
  gender: z.enum(['male', 'female']).optional().nullable(),
  languages: z.array(z.string().max(20)).default([]),
})
export type CreateDoctorInput = z.infer<typeof createDoctorInput>

export const updateDoctorInput = idem.extend({
  id: uuid,
  patch: z.object({
    full_name_ar: z.string().min(2).max(200).optional(),
    full_name_en: z.string().max(200).nullable().optional(),
    title: z.string().max(60).nullable().optional(),
    bio_ar: z.string().max(2000).nullable().optional(),
    bio_en: z.string().max(2000).nullable().optional(),
    years_experience: z.number().int().min(0).max(80).nullable().optional(),
    gender: z.enum(['male', 'female']).nullable().optional(),
    languages: z.array(z.string().max(20)).optional(),
  }),
})
export type UpdateDoctorInput = z.infer<typeof updateDoctorInput>

export const addLicenseInput = idem.extend({
  doctorId: uuid,
  license_number: z.string().min(1).max(80),
  authority: z.string().max(200).optional().nullable(),
  country: z.string().max(60).optional().nullable(),
  valid_from: z.string().date().optional().nullable(),
  valid_to: z.string().date().optional().nullable(),
  document_url: z.string().url().max(500).optional().nullable(),
})
export type AddLicenseInput = z.infer<typeof addLicenseInput>
