import { createServerFn } from '@tanstack/react-start'
import {
  createCustomerInput, updateCustomerInput, mergeCustomersInput,
  addAddressInput, addContactInput, addTagInput,
  type CreateCustomerInput, type UpdateCustomerInput, type MergeCustomersInput,
  type AddAddressInput, type AddContactInput, type AddTagInput,
} from '@/domain/crm/commands'

type RpcFn = (name: string, args: unknown) => Promise<{ data: unknown; error: { message: string } | null }>

async function emit(event: string, payload: Record<string, unknown>, correlation: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  await (supabaseAdmin.rpc as unknown as RpcFn)('emit_domain_event', {
    p_event_type: event,
    p_source: 'crm-mutations',
    p_payload: payload as unknown as never,
    p_priority: 'normal',
    p_correlation_id: correlation,
  })
}

async function assertOwnedByOrg(table: string, id: string, orgId: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any).from(table).select('organization_id').eq('id', id).single()
  if (error || !data) throw new Error(`${table}#${id} not found`)
  if (data.organization_id !== orgId) throw new Error('Cross-org access denied')
}

export const createCustomer = createServerFn({ method: 'POST' })
  .validator((raw: unknown): CreateCustomerInput => createCustomerInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { withIdempotency, newCorrelationId } = await import('./idempotency.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'customer.write')
    const correlation = data.correlationId ?? newCorrelationId('customer')

    return withIdempotency(data.idempotencyKey, actor.userId, 'createCustomer', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: row, error } = await (supabaseAdmin as any)
        .from('crm_customers')
        .insert({
          organization_id: actor.organizationId,
          full_name: data.full_name,
          phone: data.phone ?? null,
          email: data.email ?? null,
          patient_id: data.patient_id ?? null,
          notes: data.notes ?? null,
          metadata: (data.metadata ?? {}) as unknown as never,
          created_by: actor.userId,
        })
        .select('id, code')
        .single()
      if (error) throw new Error(error.message)

      await emit('CustomerCreated', { customer_id: row.id, organization_id: actor.organizationId, code: row.code }, correlation)
      await audit(actor, { action: 'customer.create', resourceType: 'customer', resourceId: row.id, payload: { code: row.code } })
      return { id: row.id as string, code: row.code as string, correlationId: correlation }
    })
  })

export const updateCustomer = createServerFn({ method: 'POST' })
  .validator((raw: unknown): UpdateCustomerInput => updateCustomerInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { newCorrelationId } = await import('./idempotency.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'customer.write')
    const correlation = data.correlationId ?? newCorrelationId('customer')

    await assertOwnedByOrg('crm_customers', data.id, actor.organizationId)

    const patch: Record<string, unknown> = {}
    for (const k of ['full_name', 'phone', 'email', 'notes', 'status', 'patient_id'] as const) {
      if (data[k] !== undefined) patch[k] = data[k]
    }
    if (Object.keys(patch).length === 0) return { id: data.id, correlationId: correlation }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any).from('crm_customers').update(patch).eq('id', data.id)
    if (error) throw new Error(error.message)

    await emit('CustomerUpdated', { customer_id: data.id, patch }, correlation)
    await audit(actor, { action: 'customer.update', resourceType: 'customer', resourceId: data.id, payload: { patch } })
    return { id: data.id, correlationId: correlation }
  })

export const archiveCustomer = createServerFn({ method: 'POST' })
  .validator((raw: unknown): { id: string } => {
    const v = raw as { id?: string }
    if (!v?.id) throw new Error('id required')
    return { id: v.id }
  })
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { newCorrelationId } = await import('./idempotency.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'customer.write')
    await assertOwnedByOrg('crm_customers', data.id, actor.organizationId)
    const correlation = newCorrelationId('customer')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any).from('crm_customers').update({ status: 'archived' }).eq('id', data.id)
    if (error) throw new Error(error.message)
    await emit('CustomerArchived', { customer_id: data.id }, correlation)
    await audit(actor, { action: 'customer.archive', resourceType: 'customer', resourceId: data.id })
    return { id: data.id, correlationId: correlation }
  })

export const mergeCustomers = createServerFn({ method: 'POST' })
  .validator((raw: unknown): MergeCustomersInput => mergeCustomersInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { newCorrelationId } = await import('./idempotency.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'customer.merge')
    if (data.targetId === data.sourceId) throw new Error('Cannot merge a customer into itself')
    await assertOwnedByOrg('crm_customers', data.targetId, actor.organizationId)
    await assertOwnedByOrg('crm_customers', data.sourceId, actor.organizationId)
    const correlation = data.correlationId ?? newCorrelationId('customer-merge')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = supabaseAdmin as any
    // Re-parent addresses/contacts/tags to target, then mark source as merged.
    await sb.from('crm_customer_addresses').update({ customer_id: data.targetId }).eq('customer_id', data.sourceId)
    await sb.from('crm_customer_contacts').update({ customer_id: data.targetId }).eq('customer_id', data.sourceId)
    // Tags may collide on the unique (customer_id, tag) index — best-effort re-parent.
    const { data: srcTags } = await sb.from('crm_customer_tags').select('tag,color').eq('customer_id', data.sourceId)
    for (const t of (srcTags ?? []) as Array<{ tag: string; color: string | null }>) {
      await sb.from('crm_customer_tags')
        .insert({ organization_id: actor.organizationId, customer_id: data.targetId, tag: t.tag, color: t.color })
        .then(() => undefined, () => undefined)
    }
    await sb.from('crm_customer_tags').delete().eq('customer_id', data.sourceId)

    const { error } = await sb.from('crm_customers')
      .update({ status: 'merged', merged_into_id: data.targetId })
      .eq('id', data.sourceId)
    if (error) throw new Error(error.message)

    await emit('CustomerMerged', { target_id: data.targetId, source_id: data.sourceId }, correlation)
    await audit(actor, { action: 'customer.merge', resourceType: 'customer', resourceId: data.targetId, payload: { source: data.sourceId } })
    return { targetId: data.targetId, correlationId: correlation }
  })

// ---------------- Addresses ----------------
export const addCustomerAddress = createServerFn({ method: 'POST' })
  .validator((raw: unknown): AddAddressInput => addAddressInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'customer.write')
    await assertOwnedByOrg('crm_customers', data.customerId, actor.organizationId)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = supabaseAdmin as any
    if (data.is_default) {
      await sb.from('crm_customer_addresses').update({ is_default: false }).eq('customer_id', data.customerId)
    }
    const { data: row, error } = await sb.from('crm_customer_addresses').insert({
      organization_id: actor.organizationId,
      customer_id: data.customerId,
      kind: data.kind,
      line1: data.line1,
      line2: data.line2 ?? null,
      city: data.city ?? null,
      region: data.region ?? null,
      country: data.country ?? null,
      postal_code: data.postal_code ?? null,
      is_default: !!data.is_default,
    }).select('id').single()
    if (error) throw new Error(error.message)
    await audit(actor, { action: 'customer.address.add', resourceType: 'customer', resourceId: data.customerId, payload: { address_id: row.id, kind: data.kind } })
    return { id: row.id as string }
  })

// ---------------- Contacts ----------------
export const addCustomerContact = createServerFn({ method: 'POST' })
  .validator((raw: unknown): AddContactInput => addContactInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'customer.write')
    await assertOwnedByOrg('crm_customers', data.customerId, actor.organizationId)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = supabaseAdmin as any
    if (data.is_primary) {
      await sb.from('crm_customer_contacts').update({ is_primary: false }).eq('customer_id', data.customerId).eq('kind', data.kind)
    }
    const { data: row, error } = await sb.from('crm_customer_contacts').insert({
      organization_id: actor.organizationId,
      customer_id: data.customerId,
      kind: data.kind,
      value: data.value,
      label: data.label ?? null,
      is_primary: !!data.is_primary,
    }).select('id').single()
    if (error) throw new Error(error.message)
    await audit(actor, { action: 'customer.contact.add', resourceType: 'customer', resourceId: data.customerId, payload: { contact_id: row.id, kind: data.kind } })
    return { id: row.id as string }
  })

// ---------------- Tags ----------------
export const addCustomerTag = createServerFn({ method: 'POST' })
  .validator((raw: unknown): AddTagInput => addTagInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'customer.write')
    await assertOwnedByOrg('crm_customers', data.customerId, actor.organizationId)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabaseAdmin as any).from('crm_customer_tags').insert({
      organization_id: actor.organizationId,
      customer_id: data.customerId,
      tag: data.tag,
      color: data.color ?? null,
    }).select('id').single()
    if (error) throw new Error(error.message)
    await audit(actor, { action: 'customer.tag.add', resourceType: 'customer', resourceId: data.customerId, payload: { tag: data.tag } })
    return { id: row.id as string }
  })

export const removeCustomerTag = createServerFn({ method: 'POST' })
  .validator((raw: unknown): { id: string; customerId: string } => {
    const v = raw as { id?: string; customerId?: string }
    if (!v?.id || !v?.customerId) throw new Error('id and customerId required')
    return { id: v.id, customerId: v.customerId }
  })
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'customer.write')
    await assertOwnedByOrg('crm_customers', data.customerId, actor.organizationId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any).from('crm_customer_tags').delete().eq('id', data.id).eq('customer_id', data.customerId)
    if (error) throw new Error(error.message)
    await audit(actor, { action: 'customer.tag.remove', resourceType: 'customer', resourceId: data.customerId, payload: { tag_id: data.id } })
    return { ok: true }
  })
