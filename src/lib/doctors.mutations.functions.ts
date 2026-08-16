import { createServerFn } from '@tanstack/react-start'
import {
  createDoctorInput, updateDoctorInput, addLicenseInput,
  type CreateDoctorInput, type UpdateDoctorInput, type AddLicenseInput,
} from '@/domain/doctors/commands'

type RpcFn = (name: string, args: unknown) => Promise<{ data: unknown; error: { message: string } | null }>

async function emit(event: string, payload: Record<string, unknown>, correlation: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  await (supabaseAdmin.rpc as unknown as RpcFn)('emit_domain_event', {
    p_event_type: event,
    p_source: 'doctors-mutations',
    p_payload: payload as unknown as never,
    p_priority: 'normal',
    p_correlation_id: correlation,
  })
}

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

export const createDoctor = createServerFn({ method: 'POST' })
  .validator((raw: unknown): CreateDoctorInput => createDoctorInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requireOrg, requirePermission } = await import('./session.server')
    const { withIdempotency, newCorrelationId } = await import('./idempotency.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requireOrg(actor, data.organizationId)
    requirePermission(actor, 'doctor.write')
    const correlation = data.correlationId ?? newCorrelationId('doctor')

    return withIdempotency(data.idempotencyKey, actor.userId, 'createDoctor', async () => {
      const base = slugify(data.full_name_en ?? data.full_name_ar) || `doctor-${Date.now()}`
      const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`
      const { data: row, error } = await supabaseAdmin.from('hc_doctors').insert({
        organization_id: data.organizationId,
        slug,
        full_name_ar: data.full_name_ar,
        full_name_en: data.full_name_en ?? null,
        title: data.title ?? null,
        bio_ar: data.bio_ar ?? null,
        bio_en: data.bio_en ?? null,
        years_experience: data.years_experience ?? null,
        gender: data.gender ?? null,
        languages: data.languages,
      }).select('id').single()
      if (error) throw new Error(error.message)

      await emit('DoctorCreated', { doctor_id: row.id, organization_id: data.organizationId }, correlation)
      await audit(actor, { action: 'doctor.create', resourceType: 'doctor', resourceId: row.id, payload: { name: data.full_name_ar } })
      return { id: row.id as string, correlationId: correlation }
    })
  })

export const updateDoctor = createServerFn({ method: 'POST' })
  .validator((raw: unknown): UpdateDoctorInput => updateDoctorInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { newCorrelationId } = await import('./idempotency.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'doctor.write')
    const correlation = data.correlationId ?? newCorrelationId('doctor')

    const { data: existing, error: fErr } = await supabaseAdmin
      .from('hc_doctors').select('organization_id').eq('id', data.id).single()
    if (fErr) throw new Error(fErr.message)
    if (existing.organization_id !== actor.organizationId) throw new Error('Forbidden: cross-org update')

    const patch = Object.fromEntries(Object.entries(data.patch).filter(([, v]) => v !== undefined))
    const { error } = await supabaseAdmin.from('hc_doctors').update(patch as never).eq('id', data.id)
    if (error) throw new Error(error.message)

    await emit('DoctorUpdated', { doctor_id: data.id }, correlation)
    await audit(actor, { action: 'doctor.update', resourceType: 'doctor', resourceId: data.id, payload: { patch } })
    return { id: data.id, correlationId: correlation }
  })

export const addLicense = createServerFn({ method: 'POST' })
  .validator((raw: unknown): AddLicenseInput => addLicenseInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'doctor.write')

    const { data: doc, error: fErr } = await supabaseAdmin
      .from('hc_doctors').select('organization_id').eq('id', data.doctorId).single()
    if (fErr) throw new Error(fErr.message)
    if (doc.organization_id !== actor.organizationId) throw new Error('Forbidden: cross-org license')

    const { data: row, error } = await supabaseAdmin.from('hc_doctor_licenses').insert({
      doctor_id: data.doctorId,
      license_number: data.license_number,
      authority: data.authority ?? null,
      country: data.country ?? null,
      valid_from: data.valid_from ?? null,
      valid_to: data.valid_to ?? null,
      document_url: data.document_url ?? null,
    }).select('id').single()
    if (error) throw new Error(error.message)
    await audit(actor, { action: 'doctor.license.add', resourceType: 'doctor', resourceId: data.doctorId, payload: { license: data.license_number } })
    return { id: row.id as string }
  })
