import { createServerFn } from '@tanstack/react-start'
import {
  createPrescriptionInput, updatePrescriptionInput, addItemInput, removeItemInput,
  transitionInput, addNoteInput,
  type CreatePrescriptionInput, type UpdatePrescriptionInput, type AddItemInput,
  type RemoveItemInput, type TransitionInput, type AddNoteInput,
} from '@/domain/prescriptions/commands'
import { canTransition, type PrescriptionStatus } from '@/domain/prescriptions/schemas'

type RpcFn = (name: string, args: unknown) => Promise<{ data: unknown; error: { message: string } | null }>

async function emit(event: string, payload: Record<string, unknown>, correlation: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  await (supabaseAdmin.rpc as unknown as RpcFn)('emit_domain_event', {
    p_event_type: event,
    p_source: 'prescriptions-mutations',
    p_payload: payload as unknown as never,
    p_priority: 'normal',
    p_correlation_id: correlation,
  })
}

async function assertRxInOrg(prescriptionId: string, orgId: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data, error } = await supabaseAdmin
    .from('hc_prescriptions').select('id, organization_id, status').eq('id', prescriptionId).single()
  if (error) throw new Error(error.message)
  if (data.organization_id !== orgId) throw new Error('Forbidden: cross-org prescription')
  return data as { id: string; organization_id: string; status: PrescriptionStatus }
}

function assertEditableInDraft(status: PrescriptionStatus) {
  if (status !== 'draft') throw new Error(`Cannot modify items when status is "${status}". Move back to draft is not allowed.`)
}

export const createPrescription = createServerFn({ method: 'POST' })
  .validator((raw: unknown): CreatePrescriptionInput => createPrescriptionInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requireOrg, requirePermission } = await import('./session.server')
    const { withIdempotency, newCorrelationId } = await import('./idempotency.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requireOrg(actor, data.organizationId)
    requirePermission(actor, 'prescription.write')
    const correlation = data.correlationId ?? newCorrelationId('rx')

    return withIdempotency(data.idempotencyKey, actor.userId, 'createPrescription', async () => {
      const { data: rx, error } = await supabaseAdmin.from('hc_prescriptions').insert({
        organization_id: data.organizationId,
        branch_id: actor.branchId,
        patient_id: data.patient_id,
        doctor_id: data.doctor_id ?? null,
        external_doctor_name: data.external_doctor_name ?? null,
        prescription_no: data.prescription_no ?? null,
        issued_at: data.issued_at ?? new Date().toISOString(),
        diagnosis: data.diagnosis ?? null,
        notes: data.notes ?? null,
        created_by: actor.userId,
        status: 'draft',
      }).select('id').single()
      if (error) throw new Error(error.message)
      const rxId = rx.id as string

      if (data.items.length > 0) {
        const { error: itErr } = await supabaseAdmin.from('hc_prescription_items').insert(
          data.items.map((it) => ({
            prescription_id: rxId,
            product_id: it.product_id ?? null,
            medication_name: it.medication_name,
            strength: it.strength ?? null,
            form: it.form ?? null,
            dose: it.dose ?? null,
            frequency: it.frequency ?? null,
            duration_days: it.duration_days ?? null,
            quantity: it.quantity,
            route: it.route ?? null,
            instructions: it.instructions ?? null,
          })),
        )
        if (itErr) throw new Error(itErr.message)
      }

      await supabaseAdmin.from('hc_prescription_status_history').insert({
        prescription_id: rxId, from_status: null, to_status: 'draft', changed_by: actor.userId,
      })
      await emit('PrescriptionCreated', { prescription_id: rxId, organization_id: data.organizationId }, correlation)
      await audit(actor, { action: 'prescription.create', resourceType: 'prescription', resourceId: rxId, payload: { items: data.items.length } })
      return { id: rxId, correlationId: correlation }
    })
  })

export const updatePrescription = createServerFn({ method: 'POST' })
  .validator((raw: unknown): UpdatePrescriptionInput => updatePrescriptionInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { newCorrelationId } = await import('./idempotency.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'prescription.write')
    const correlation = data.correlationId ?? newCorrelationId('rx')

    const rx = await assertRxInOrg(data.id, actor.organizationId)
    if (rx.status === 'cancelled' || rx.status === 'approved') {
      throw new Error(`Cannot edit metadata when status is "${rx.status}"`)
    }
    const patch = Object.fromEntries(Object.entries(data.patch).filter(([, v]) => v !== undefined))
    const { error } = await supabaseAdmin.from('hc_prescriptions').update(patch as never).eq('id', data.id)
    if (error) throw new Error(error.message)

    await emit('PrescriptionUpdated', { prescription_id: data.id }, correlation)
    await audit(actor, { action: 'prescription.update', resourceType: 'prescription', resourceId: data.id, payload: { patch } })
    return { id: data.id, correlationId: correlation }
  })

export const addPrescriptionItem = createServerFn({ method: 'POST' })
  .validator((raw: unknown): AddItemInput => addItemInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'prescription.write')

    const rx = await assertRxInOrg(data.prescriptionId, actor.organizationId)
    assertEditableInDraft(rx.status)

    const { data: row, error } = await supabaseAdmin.from('hc_prescription_items').insert({
      prescription_id: data.prescriptionId,
      product_id: data.item.product_id ?? null,
      medication_name: data.item.medication_name,
      strength: data.item.strength ?? null,
      form: data.item.form ?? null,
      dose: data.item.dose ?? null,
      frequency: data.item.frequency ?? null,
      duration_days: data.item.duration_days ?? null,
      quantity: data.item.quantity,
      route: data.item.route ?? null,
      instructions: data.item.instructions ?? null,
    }).select('id').single()
    if (error) throw new Error(error.message)
    await audit(actor, { action: 'prescription.item.add', resourceType: 'prescription', resourceId: data.prescriptionId, payload: { medication: data.item.medication_name } })
    return { id: row.id as string }
  })

export const removePrescriptionItem = createServerFn({ method: 'POST' })
  .validator((raw: unknown): RemoveItemInput => removeItemInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'prescription.write')

    const rx = await assertRxInOrg(data.prescriptionId, actor.organizationId)
    assertEditableInDraft(rx.status)

    const { error } = await supabaseAdmin.from('hc_prescription_items')
      .delete().eq('id', data.itemId).eq('prescription_id', data.prescriptionId)
    if (error) throw new Error(error.message)
    await audit(actor, { action: 'prescription.item.remove', resourceType: 'prescription', resourceId: data.prescriptionId, payload: { itemId: data.itemId } })
    return { ok: true as const }
  })

export const transitionPrescription = createServerFn({ method: 'POST' })
  .validator((raw: unknown): TransitionInput => transitionInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { newCorrelationId } = await import('./idempotency.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'prescription.write')
    const correlation = data.correlationId ?? newCorrelationId('rx')

    const rx = await assertRxInOrg(data.prescriptionId, actor.organizationId)
    if (!canTransition(rx.status, data.to)) {
      throw new Error(`Illegal transition: ${rx.status} → ${data.to}`)
    }

    if (data.to === 'submitted' || data.to === 'validated' || data.to === 'approved') {
      const { count } = await supabaseAdmin.from('hc_prescription_items')
        .select('id', { count: 'exact', head: true }).eq('prescription_id', data.prescriptionId)
      if (!count || count === 0) throw new Error('Prescription must contain at least one item before submission')
    }

    const { error } = await supabaseAdmin.from('hc_prescriptions')
      .update({ status: data.to }).eq('id', data.prescriptionId)
    if (error) throw new Error(error.message)

    await supabaseAdmin.from('hc_prescription_status_history').insert({
      prescription_id: data.prescriptionId,
      from_status: rx.status, to_status: data.to,
      changed_by: actor.userId, reason: data.reason ?? null,
    })

    const eventName =
      data.to === 'submitted' ? 'PrescriptionSubmitted' :
      data.to === 'validated' ? 'PrescriptionValidated' :
      data.to === 'approved'  ? 'PrescriptionApproved'  :
      'PrescriptionCancelled'
    await emit(eventName, { prescription_id: data.prescriptionId, from: rx.status, to: data.to }, correlation)
    await audit(actor, { action: `prescription.${data.to}`, resourceType: 'prescription', resourceId: data.prescriptionId, payload: { from: rx.status, to: data.to, reason: data.reason ?? null } })
    return { id: data.prescriptionId, status: data.to, correlationId: correlation }
  })

export const addPrescriptionNote = createServerFn({ method: 'POST' })
  .validator((raw: unknown): AddNoteInput => addNoteInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'prescription.write')

    await assertRxInOrg(data.prescriptionId, actor.organizationId)
    const { data: row, error } = await supabaseAdmin.from('hc_prescription_notes').insert({
      prescription_id: data.prescriptionId, author_id: actor.userId, body: data.body,
    }).select('id').single()
    if (error) throw new Error(error.message)
    await audit(actor, { action: 'prescription.note.add', resourceType: 'prescription', resourceId: data.prescriptionId })
    return { id: row.id as string }
  })
