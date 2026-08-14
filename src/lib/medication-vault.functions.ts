import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { z } from 'zod'

export const SCHEDULE_PRESETS = ['قبل الطعام', 'بعد الطعام', 'يومياً', 'عند اللزوم'] as const
export type SchedulePreset = (typeof SCHEDULE_PRESETS)[number]

export interface ChronicMedication {
  id: string
  medicine_name: string
  dose: string | null
  schedule_preset: SchedulePreset
  times_per_day: number
  start_date: string | null
  notes: string | null
  is_active: boolean
}

export interface VaultBoxPhoto {
  id: string
  title: string
  storage_path: string
  created_at: string
  url: string | null
}

const MED_COLUMNS = 'id, medicine_name, dose, schedule_preset, times_per_day, start_date, notes, is_active'
const VAULT_BUCKET = 'medical-vault'

const medInput = z.object({
  id: z.string().uuid().optional(),
  medicineName: z.string().trim().min(1).max(120),
  dose: z.string().trim().max(80).optional().nullable(),
  schedulePreset: z.enum(SCHEDULE_PRESETS),
  timesPerDay: z.number().int().min(1).max(12).default(1),
  startDate: z.string().trim().max(20).optional().nullable(),
  notes: z.string().trim().max(400).optional().nullable(),
  isActive: z.boolean().default(true),
})

export const listChronicMedications = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChronicMedication[]> => {
    const { data, error } = await context.supabase
      .from('patient_chronic_medications')
      .select(MED_COLUMNS)
      .eq('user_id', context.userId)
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []) as unknown as ChronicMedication[]
  })

export const saveChronicMedication = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => medInput.parse(raw))
  .handler(async ({ data, context }): Promise<ChronicMedication> => {
    const row = {
      user_id: context.userId,
      medicine_name: data.medicineName,
      dose: data.dose || null,
      schedule_preset: data.schedulePreset,
      times_per_day: data.timesPerDay,
      start_date: data.startDate || null,
      notes: data.notes || null,
      is_active: data.isActive,
    }
    const query = data.id
      ? context.supabase
          .from('patient_chronic_medications')
          .update(row)
          .eq('id', data.id)
          .eq('user_id', context.userId)
          .select(MED_COLUMNS)
          .single()
      : context.supabase
          .from('patient_chronic_medications')
          .insert(row)
          .select(MED_COLUMNS)
          .single()
    const { data: saved, error } = await query
    if (error) throw new Error(error.message)
    return saved as unknown as ChronicMedication
  })

export const deleteChronicMedication = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from('patient_chronic_medications')
      .delete()
      .eq('id', data.id)
      .eq('user_id', context.userId)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

/** Find-or-create the hc_patients row that represents the signed-in user. */
async function ensureSelfPatientId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<string> {
  const existing = await supabase
    .from('hc_patients')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()
  if (existing.error) throw new Error(existing.error.message)
  if (existing.data?.id) return existing.data.id as string

  const created = await supabase
    .from('hc_patients')
    .insert({ user_id: userId, full_name: 'حسابي الصحي' })
    .select('id')
    .single()
  if (created.error) throw new Error(created.error.message)
  return created.data.id as string
}

export const listVaultBoxPhotos = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VaultBoxPhoto[]> => {
    const patientId = await ensureSelfPatientId(context.supabase, context.userId)
    const { data, error } = await context.supabase
      .from('medical_vault_files')
      .select('id, title, storage_path, created_at')
      .eq('patient_id', patientId)
      .eq('file_type', 'medication_box')
      .order('created_at', { ascending: false })
      .limit(60)
    if (error) throw new Error(error.message)

    const rows = data ?? []
    const signed = await Promise.all(
      rows.map(async (r) => {
        const res = await context.supabase.storage
          .from(VAULT_BUCKET)
          .createSignedUrl(r.storage_path, 3600)
        return { ...r, url: res.data?.signedUrl ?? null } as VaultBoxPhoto
      }),
    )
    return signed
  })

/** Returns a short-lived signed upload URL scoped to the user's own folder. */
export const createVaultUploadUrl = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ extension: z.enum(['jpg', 'jpeg', 'png', 'webp']) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const path = `${context.userId}/boxes/${crypto.randomUUID()}.${data.extension}`
    const { data: signed, error } = await context.supabase.storage
      .from(VAULT_BUCKET)
      .createSignedUploadUrl(path)
    if (error) throw new Error(error.message)
    return { path, token: signed.token, bucket: VAULT_BUCKET }
  })

export const registerVaultBoxPhoto = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        path: z.string().min(3).max(300),
        title: z.string().trim().min(1).max(120),
        sizeBytes: z.number().int().nonnegative().optional(),
        mimeType: z.string().max(80).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    if (!data.path.startsWith(`${context.userId}/`)) throw new Error('مسار غير مسموح')
    const patientId = await ensureSelfPatientId(context.supabase, context.userId)
    const { error } = await context.supabase.from('medical_vault_files').insert({
      patient_id: patientId,
      uploaded_by: context.userId,
      file_type: 'medication_box',
      title: data.title,
      storage_path: data.path,
      size_bytes: data.sizeBytes ?? null,
      mime_type: data.mimeType ?? null,
    })
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const deleteVaultBoxPhoto = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: row, error: readErr } = await context.supabase
      .from('medical_vault_files')
      .select('id, storage_path')
      .eq('id', data.id)
      .maybeSingle()
    if (readErr) throw new Error(readErr.message)
    if (!row) throw new Error('الملف غير موجود')

    await context.supabase.storage.from(VAULT_BUCKET).remove([row.storage_path])
    const { error } = await context.supabase.from('medical_vault_files').delete().eq('id', data.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })
