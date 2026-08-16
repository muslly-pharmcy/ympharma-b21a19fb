import { createServerFn } from '@tanstack/react-start'
import {
  createSupplierInput,
  updateSupplierInput,
  type CreateSupplierInput,
  type UpdateSupplierInput,
} from '@/domain/suppliers/commands'

export const createSupplier = createServerFn({ method: 'POST' })
  .validator((raw: unknown): CreateSupplierInput => createSupplierInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requireOrg, requirePermission } = await import('./session.server')
    const { withIdempotency, newCorrelationId } = await import('./idempotency.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requireOrg(actor, data.organizationId)
    requirePermission(actor, 'supplier.write')
    const correlation = data.correlationId ?? newCorrelationId('supplier')

    return withIdempotency(data.idempotencyKey, actor.userId, 'createSupplier', async () => {
      const { data: row, error } = await supabaseAdmin
        .from('sup_suppliers')
        .insert({
          organization_id: data.organizationId,
          code: data.code ?? null,
          name: data.name,
          legal_name: data.legal_name ?? null,
          tax_id: data.tax_id ?? null,
          contact: (data.contact ?? {}) as unknown as never,
          status: 'active',
          created_by: actor.userId,
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      await (supabaseAdmin.rpc as unknown as (name: string, args: unknown) => Promise<{ data: unknown; error: { message: string } | null }>)('emit_domain_event', {
        p_event_type: 'SupplierCreated',
        p_source: 'suppliers-mutations',
        p_payload: { supplier_id: row.id, organization_id: data.organizationId } as unknown as never,
        p_priority: 'normal',
        p_correlation_id: correlation,
      })
      await audit(actor, { action: 'supplier.create', resourceType: 'supplier', resourceId: row.id, payload: { name: data.name } })
      return { id: row.id, correlationId: correlation }
    })
  })

export const updateSupplier = createServerFn({ method: 'POST' })
  .validator((raw: unknown): UpdateSupplierInput => updateSupplierInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { newCorrelationId } = await import('./idempotency.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'supplier.write')
    const correlation = data.correlationId ?? newCorrelationId('supplier')

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('sup_suppliers')
      .select('organization_id')
      .eq('id', data.id)
      .single()
    if (fetchErr) throw new Error(fetchErr.message)
    if (existing.organization_id !== actor.organizationId) {
      throw new Error('Forbidden: cross-org update')
    }
    const patch = Object.fromEntries(
      Object.entries(data.patch).filter(([, v]) => v !== undefined),
    )
    const { error } = await supabaseAdmin.from('sup_suppliers').update(patch as never).eq('id', data.id)
    if (error) throw new Error(error.message)

    await (supabaseAdmin.rpc as unknown as (name: string, args: unknown) => Promise<{ data: unknown; error: { message: string } | null }>)('emit_domain_event', {
      p_event_type: 'SupplierUpdated',
      p_source: 'suppliers-mutations',
      p_payload: { supplier_id: data.id } as unknown as never,
      p_priority: 'normal',
      p_correlation_id: correlation,
    })
    await audit(actor, { action: 'supplier.update', resourceType: 'supplier', resourceId: data.id, payload: { patch } })
    return { id: data.id, correlationId: correlation }
  })
