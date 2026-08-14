import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { z } from 'zod'
import { sanitizeFilterTerm, ilikeContains } from '@/lib/security/postgrest-filter'


export interface RosterPatient {
  id: string
  user_id: string | null
  full_name: string
  phone: string | null
  mrn: string | null
}

export interface InspectorMedication {
  id: string
  medicine_name: string
  dose: string | null
  schedule_preset: string
  times_per_day: number
  is_active: boolean
  notes: string | null
}

export interface InspectorPhoto {
  id: string
  title: string
  created_at: string
  url: string | null
}

export interface InspectorDetail {
  patient: RosterPatient
  medications: InspectorMedication[]
  photos: InspectorPhoto[]
  conditions: string[]
  allergies: string[]
}

async function assertStaff(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<void> {
  const [admin, owner] = await Promise.all([
    supabase.rpc('has_role', { _user_id: userId, _role: 'admin' }),
    supabase.rpc('has_role', { _user_id: userId, _role: 'owner' }),
  ])
  if (!admin.data && !owner.data) throw new Error('صلاحيات الصيدلي/المدير مطلوبة')
}

export const searchPatientRoster = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ q: z.string().trim().max(80).default('') }).parse(raw),
  )
  .handler(async ({ data, context }): Promise<RosterPatient[]> => {
    await assertStaff(context.supabase, context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    let query = supabaseAdmin
      .from('hc_patients')
      .select('id, user_id, full_name, phone, mrn')
      .order('created_at', { ascending: false })
      .limit(40)
    // Never interpolate the raw term: PostgREST parses `or()` as an expression.
    const term = sanitizeFilterTerm(data.q)
    if (term) query = query.or(`${ilikeContains('full_name', term)},${ilikeContains('phone', term)}`)

    const { data: rows, error } = await query
    if (error) throw new Error(error.message)
    return (rows ?? []) as unknown as RosterPatient[]
  })

export const getPatientMedicationDetail = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ patientId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<InspectorDetail> => {
    await assertStaff(context.supabase, context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    const { data: patient, error: pErr } = await supabaseAdmin
      .from('hc_patients')
      .select('id, user_id, full_name, phone, mrn')
      .eq('id', data.patientId)
      .maybeSingle()
    if (pErr) throw new Error(pErr.message)
    if (!patient) throw new Error('المريض غير موجود')

    const [medsRes, filesRes] = await Promise.all([
      patient.user_id
        ? supabaseAdmin
            .from('patient_chronic_medications')
            .select('id, medicine_name, dose, schedule_preset, times_per_day, is_active, notes')
            .eq('user_id', patient.user_id)
            .order('is_active', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      supabaseAdmin
        .from('medical_vault_files')
        .select('id, title, created_at, storage_path')
        .eq('patient_id', data.patientId)
        .eq('file_type', 'medication_box')
        .order('created_at', { ascending: false })
        .limit(24),
    ])
    if (medsRes.error) throw new Error(medsRes.error.message)
    if (filesRes.error) throw new Error(filesRes.error.message)

    const photos = await Promise.all(
      (filesRes.data ?? []).map(async (f) => {
        const signed = await supabaseAdmin.storage
          .from('medical-vault')
          .createSignedUrl(f.storage_path, 3600)
        return {
          id: f.id,
          title: f.title,
          created_at: f.created_at,
          url: signed.data?.signedUrl ?? null,
        }
      }),
    )

    let conditions: string[] = []
    let allergies: string[] = []
    if (patient.user_id) {
      const { data: profile } = await supabaseAdmin
        .from('family_health_profiles')
        .select('chronic_conditions, allergies')
        .eq('user_id', patient.user_id)
        .eq('is_default', true)
        .maybeSingle()
      conditions = profile?.chronic_conditions ?? []
      allergies = profile?.allergies ?? []
    }

    return {
      patient: patient as unknown as RosterPatient,
      medications: (medsRes.data ?? []) as unknown as InspectorMedication[],
      photos,
      conditions,
      allergies,
    }
  })
