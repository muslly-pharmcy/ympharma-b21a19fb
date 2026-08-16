import { createServerFn } from '@tanstack/react-start'
import {
  createPatientInput, updatePatientInput, addAllergyInput,
  addConditionInput, addEmergencyContactInput, mergePatientsInput,
  type CreatePatientInput, type UpdatePatientInput, type AddAllergyInput,
  type AddConditionInput, type AddEmergencyContactInput, type MergePatientsInput,
} from '@/domain/patients/commands'

type RpcFn = (name: string, args: unknown) => Promise<{ data: unknown; error: { message: string } | null }>

async function emit(event: string, payload: Record<string, unknown>, correlation: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  await (supabaseAdmin.rpc as unknown as RpcFn)('emit_domain_event', {
    p_event_type: event,
    p_source: 'patients-mutations',
    p_payload: payload as unknown as never,
    p_priority: 'normal',
    p_correlation_id: correlation,
  })
}

export const createPatient = createServerFn({ method: 'POST' })
  .validator((raw: unknown): CreatePatientInput => createPatientInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requireOrg, requirePermission } = await import('./session.server')
    const { withIdempotency, newCorrelationId } = await import('./idempotency.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requireOrg(actor, data.organizationId)
    requirePermission(actor, 'patient.write')
    const correlation = data.correlationId ?? newCorrelationId('patient')

    return withIdempotency(data.idempotencyKey, actor.userId, 'createPatient', async () => {
      const { data: row, error } = await supabaseAdmin
        .from('hc_patients')
        .insert({
          organization_id: data.organizationId,
          full_name: data.full_name,
          phone: data.phone ?? null,
          email: data.email ?? null,
          date_of_birth: data.date_of_birth ?? null,
          gender: data.gender ?? null,
          blood_type: data.blood_type ?? null,
          metadata: (data.metadata ?? {}) as unknown as never,
          created_by: actor.userId,
        })
        .select('id, mrn')
        .single()
      if (error) throw new Error(error.message)

      await emit('PatientCreated', { patient_id: row.id, organization_id: data.organizationId, mrn: row.mrn }, correlation)
      await audit(actor, { action: 'patient.create', resourceType: 'patient', resourceId: row.id, payload: { mrn: row.mrn } })
      return { id: row.id as string, mrn: row.mrn as string | null, correlationId: correlation }
    })
  })

export const updatePatient = createServerFn({ method: 'POST' })
  .validator((raw: unknown): UpdatePatientInput => updatePatientInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { newCorrelationId } = await import('./idempotency.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'patient.write')
    const correlation = data.correlationId ?? newCorrelationId('patient')

    const { data: existing, error: fErr } = await supabaseAdmin
      .from('hc_patients').select('organization_id').eq('id', data.id).single()
    if (fErr) throw new Error(fErr.message)
    if (existing.organization_id !== actor.organizationId) throw new Error('Forbidden: cross-org update')

    const patch = Object.fromEntries(Object.entries(data.patch).filter(([, v]) => v !== undefined))
    const { error } = await supabaseAdmin.from('hc_patients').update(patch as never).eq('id', data.id)
    if (error) throw new Error(error.message)

    await emit('PatientUpdated', { patient_id: data.id }, correlation)
    await audit(actor, { action: 'patient.update', resourceType: 'patient', resourceId: data.id, payload: { patch } })
    return { id: data.id, correlationId: correlation }
  })

async function assertPatientInOrg(patientId: string, orgId: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data, error } = await supabaseAdmin
    .from('hc_patients').select('organization_id').eq('id', patientId).single()
  if (error) throw new Error(error.message)
  if (data.organization_id !== orgId) throw new Error('Forbidden: cross-org access')
}

export const addAllergy = createServerFn({ method: 'POST' })
  .validator((raw: unknown): AddAllergyInput => addAllergyInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'patient.write')
    await assertPatientInOrg(data.patientId, actor.organizationId)

    const { data: row, error } = await supabaseAdmin.from('patient_allergies').insert({
      patient_id: data.patientId,
      allergen: data.allergen,
      severity: data.severity,
      reaction: data.reaction ?? null,
      notes: data.notes ?? null,
      recorded_by: actor.userId,
    }).select('id').single()
    if (error) throw new Error(error.message)
    await audit(actor, { action: 'patient.allergy.add', resourceType: 'patient', resourceId: data.patientId, payload: { allergen: data.allergen, severity: data.severity } })
    return { id: row.id as string }
  })

export const addCondition = createServerFn({ method: 'POST' })
  .validator((raw: unknown): AddConditionInput => addConditionInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'patient.write')
    await assertPatientInOrg(data.patientId, actor.organizationId)

    const { data: row, error } = await supabaseAdmin.from('patient_conditions').insert({
      patient_id: data.patientId,
      condition_name: data.condition_name,
      icd10: data.icd10 ?? null,
      status: data.status,
      onset_date: data.onset_date ?? null,
      notes: data.notes ?? null,
      recorded_by: actor.userId,
    }).select('id').single()
    if (error) throw new Error(error.message)
    await audit(actor, { action: 'patient.condition.add', resourceType: 'patient', resourceId: data.patientId, payload: { condition: data.condition_name } })
    return { id: row.id as string }
  })

export const addEmergencyContact = createServerFn({ method: 'POST' })
  .validator((raw: unknown): AddEmergencyContactInput => addEmergencyContactInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'patient.write')
    await assertPatientInOrg(data.patientId, actor.organizationId)

    const { data: row, error } = await supabaseAdmin.from('patient_emergency_contacts').insert({
      patient_id: data.patientId,
      name: data.name,
      relation: data.relation ?? null,
      phone: data.phone,
      is_primary: data.is_primary,
    }).select('id').single()
    if (error) throw new Error(error.message)
    await audit(actor, { action: 'patient.emergency.add', resourceType: 'patient', resourceId: data.patientId })
    return { id: row.id as string }
  })

export const mergePatients = createServerFn({ method: 'POST' })
  .validator((raw: unknown): MergePatientsInput => mergePatientsInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { newCorrelationId } = await import('./idempotency.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'patient.write')
    if (data.sourceId === data.targetId) throw new Error('Cannot merge patient into itself')
    const correlation = data.correlationId ?? newCorrelationId('patient-merge')

    const { data: rows, error } = await supabaseAdmin
      .from('hc_patients').select('id, organization_id').in('id', [data.sourceId, data.targetId])
    if (error) throw new Error(error.message)
    if (!rows || rows.length !== 2) throw new Error('Source or target patient not found')
    for (const r of rows) if (r.organization_id !== actor.organizationId) throw new Error('Forbidden: cross-org merge')

    const { error: uErr } = await supabaseAdmin.from('hc_patients')
      .update({ is_active: false, merged_into_id: data.targetId })
      .eq('id', data.sourceId)
    if (uErr) throw new Error(uErr.message)

    await emit('PatientMerged', { source_id: data.sourceId, target_id: data.targetId }, correlation)
    await audit(actor, { action: 'patient.merge', resourceType: 'patient', resourceId: data.targetId, payload: { source: data.sourceId } })
    return { targetId: data.targetId, correlationId: correlation }
  })
