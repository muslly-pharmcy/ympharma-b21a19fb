import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type {
  Dispense, DispenseItem, DispenseStatusHistory, DispenseReturn,
} from '@/domain/dispenses/schemas'

export const listDispenses = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => z.object({
    search: z.string().optional(),
    status: z.string().optional(),
    prescriptionId: z.string().uuid().optional(),
    patientId: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(200).default(50),
  }).parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const actor = await getActor()
    requirePermission(actor, 'dispense.read')

    let q = supabaseAdmin
      .from('hc_dispenses')
      .select('*, prescription:hc_prescriptions(id, prescription_no, status), patient:hc_patients(id, full_name, mrn)')
      .eq('organization_id', actor.organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(data.limit)

    if (data.status) q = q.eq('status', data.status)
    if (data.prescriptionId) q = q.eq('prescription_id', data.prescriptionId)
    if (data.patientId) q = q.eq('patient_id', data.patientId)
    if (data.search) q = q.ilike('dispense_no', `%${data.search}%`)

    const { data: rows, error } = await q
    if (error) throw new Error(error.message)
    return { dispenses: (rows ?? []) as unknown as Array<Dispense & {
      prescription: { id: string; prescription_no: string | null; status: string } | null
      patient: { id: string; full_name: string; mrn: string | null } | null
    }> }
  })

export const listPendingDispenses = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => z.object({}).parse(raw ?? {}))
  .handler(async () => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const actor = await getActor()
    requirePermission(actor, 'dispense.read')
    const { data, error } = await supabaseAdmin
      .from('hc_dispenses')
      .select('id, dispense_no, status, created_at, patient:hc_patients(id, full_name)')
      .eq('organization_id', actor.organizationId)
      .in('status', ['draft','prepared','verified'])
      .is('deleted_at', null)
      .order('created_at')
    if (error) throw new Error(error.message)
    return { pending: data ?? [] }
  })

export const getDispense = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission, requireOrg } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const actor = await getActor()
    requirePermission(actor, 'dispense.read')

    const { data: d, error } = await supabaseAdmin
      .from('hc_dispenses')
      .select('*, prescription:hc_prescriptions(id, prescription_no, status, diagnosis), patient:hc_patients(id, full_name, mrn, phone)')
      .eq('id', data.id).single()
    if (error) throw new Error(error.message)
    requireOrg(actor, (d as unknown as { organization_id: string }).organization_id)

    const [{ data: items }, { data: history }, { data: returns }] = await Promise.all([
      supabaseAdmin.from('hc_dispense_items').select('*').eq('dispense_id', data.id).order('created_at'),
      supabaseAdmin.from('hc_dispense_status_history').select('*').eq('dispense_id', data.id).order('created_at'),
      supabaseAdmin.from('hc_dispense_returns').select('*').eq('dispense_id', data.id).order('created_at'),
    ])

    return {
      dispense: d as unknown as Dispense & {
        prescription: { id: string; prescription_no: string | null; status: string; diagnosis: string | null } | null
        patient: { id: string; full_name: string; mrn: string | null; phone: string | null } | null
      },
      items: (items ?? []) as unknown as DispenseItem[],
      history: (history ?? []) as unknown as DispenseStatusHistory[],
      returns: (returns ?? []) as unknown as DispenseReturn[],
    }
  })
