import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type {
  Prescription, PrescriptionItem, PrescriptionStatusHistory, PrescriptionNote,
} from '@/domain/prescriptions/schemas'

export const listPrescriptions = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => z.object({
    search: z.string().optional(),
    status: z.string().optional(),
    patientId: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(200).default(50),
  }).parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const actor = await getActor()
    requirePermission(actor, 'prescription.read')

    let q = supabaseAdmin
      .from('hc_prescriptions')
      .select('*, patient:hc_patients(id, full_name, mrn), doctor:hc_doctors(id, full_name_ar)')
      .eq('organization_id', actor.organizationId)
      .order('issued_at', { ascending: false })
      .limit(data.limit)

    if (data.status) q = q.eq('status', data.status)
    if (data.patientId) q = q.eq('patient_id', data.patientId)
    if (data.search) q = q.or(`prescription_no.ilike.%${data.search}%,diagnosis.ilike.%${data.search}%`)

    const { data: rows, error } = await q
    if (error) throw new Error(error.message)
    return { prescriptions: (rows ?? []) as unknown as Array<Prescription & {
      patient: { id: string; full_name: string; mrn: string | null } | null
      doctor: { id: string; full_name_ar: string } | null
    }> }
  })

export const getPrescription = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission, requireOrg } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const actor = await getActor()
    requirePermission(actor, 'prescription.read')

    const { data: rx, error } = await supabaseAdmin
      .from('hc_prescriptions')
      .select('*, patient:hc_patients(id, full_name, mrn, phone), doctor:hc_doctors(id, full_name_ar, title)')
      .eq('id', data.id).single()
    if (error) throw new Error(error.message)
    requireOrg(actor, (rx as unknown as { organization_id: string }).organization_id)

    const [{ data: items }, { data: history }, { data: notes }] = await Promise.all([
      supabaseAdmin.from('hc_prescription_items').select('*').eq('prescription_id', data.id).order('created_at'),
      supabaseAdmin.from('hc_prescription_status_history').select('*').eq('prescription_id', data.id).order('created_at'),
      supabaseAdmin.from('hc_prescription_notes').select('*').eq('prescription_id', data.id).order('created_at'),
    ])

    return {
      prescription: rx as unknown as Prescription & {
        patient: { id: string; full_name: string; mrn: string | null; phone: string | null } | null
        doctor: { id: string; full_name_ar: string; title: string | null } | null
      },
      items: (items ?? []) as unknown as PrescriptionItem[],
      history: (history ?? []) as unknown as PrescriptionStatusHistory[],
      notes: (notes ?? []) as unknown as PrescriptionNote[],
    }
  })
