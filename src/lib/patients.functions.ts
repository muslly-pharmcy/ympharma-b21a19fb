import { createServerFn } from '@tanstack/react-start'
import type { Patient, PatientAllergy, PatientCondition, EmergencyContact } from '@/domain/patients/schemas'

const sel = (s: string): string => s

export const listPatients = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Patient[]> => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const actor = await getActor()
    requirePermission(actor, 'patient.read')
    const { data, error } = await supabaseAdmin
      .from('hc_patients')
      .select(sel('*'))
      .eq('organization_id', actor.organizationId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) {
      console.error('[listPatients]', error)
      return []
    }
    return (data ?? []) as unknown as Patient[]
  },
)

export const getPatient = createServerFn({ method: 'GET' })
  .validator((raw: unknown): { id: string } => {
    const v = raw as { id?: string }
    if (!v?.id) throw new Error('id required')
    return { id: v.id }
  })
  .handler(async ({ data }): Promise<{
    patient: Patient
    allergies: PatientAllergy[]
    conditions: PatientCondition[]
    emergencyContacts: EmergencyContact[]
  } | null> => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const actor = await getActor()
    requirePermission(actor, 'patient.read')

    const { data: p, error } = await supabaseAdmin
      .from('hc_patients')
      .select(sel('*'))
      .eq('id', data.id)
      .eq('organization_id', actor.organizationId)
      .maybeSingle()
    if (error || !p) return null

    const [{ data: a }, { data: c }, { data: e }] = await Promise.all([
      supabaseAdmin.from('patient_allergies').select(sel('*')).eq('patient_id', data.id).order('recorded_at', { ascending: false }),
      supabaseAdmin.from('patient_conditions').select(sel('*')).eq('patient_id', data.id).order('created_at', { ascending: false }),
      supabaseAdmin.from('patient_emergency_contacts').select(sel('*')).eq('patient_id', data.id).order('is_primary', { ascending: false }),
    ])

    return {
      patient: p as unknown as Patient,
      allergies: (a ?? []) as unknown as PatientAllergy[],
      conditions: (c ?? []) as unknown as PatientCondition[],
      emergencyContacts: (e ?? []) as unknown as EmergencyContact[],
    }
  })
