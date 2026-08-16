import { createServerFn } from '@tanstack/react-start'
import type { Doctor, DoctorLicense } from '@/domain/doctors/schemas'

const sel = (s: string): string => s

export const listDoctors = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Doctor[]> => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const actor = await getActor()
    requirePermission(actor, 'doctor.read')
    const { data, error } = await supabaseAdmin
      .from('hc_doctors')
      .select(sel('*'))
      .eq('organization_id', actor.organizationId)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) {
      console.error('[listDoctors]', error)
      return []
    }
    return (data ?? []) as unknown as Doctor[]
  },
)

export const getDoctor = createServerFn({ method: 'GET' })
  .validator((raw: unknown): { id: string } => {
    const v = raw as { id?: string }
    if (!v?.id) throw new Error('id required')
    return { id: v.id }
  })
  .handler(async ({ data }): Promise<{ doctor: Doctor; licenses: DoctorLicense[] } | null> => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const actor = await getActor()
    requirePermission(actor, 'doctor.read')

    const { data: d } = await supabaseAdmin
      .from('hc_doctors').select(sel('*')).eq('id', data.id)
      .eq('organization_id', actor.organizationId).maybeSingle()
    if (!d) return null

    const { data: lic } = await supabaseAdmin
      .from('hc_doctor_licenses').select(sel('*')).eq('doctor_id', data.id)
      .order('created_at', { ascending: false })

    return {
      doctor: d as unknown as Doctor,
      licenses: (lic ?? []) as unknown as DoctorLicense[],
    }
  })
