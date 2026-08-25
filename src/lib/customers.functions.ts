import { createServerFn } from '@tanstack/react-start'
import type { Customer, CustomerAddress, CustomerContact, CustomerTag } from '@/domain/crm/schemas'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const sel = (s: string): string => s

export const listCustomers = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown): { search?: string; status?: 'active' | 'archived' | 'all' } => {
    const v = (raw ?? {}) as { search?: string; status?: string }
    const status = v.status === 'archived' || v.status === 'all' ? v.status : 'active'
    return {
      search: v.search?.trim() || undefined,
      status: status as 'active' | 'archived' | 'all',
    }
  })
  .handler(async ({ data, context }): Promise<Customer[]> => {
    const { getActorFromSupabase, requirePermission } = await import('./session.server')
    const actor = await getActorFromSupabase(context.supabase, context.userId)
    requirePermission(actor, 'customer.read')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = (context.supabase as any)
      .from('crm_customers')
      .select(sel('*'))
      .eq('organization_id', actor.organizationId)
      .order('created_at', { ascending: false })
      .limit(200)

    if (data.status !== 'all') q = q.eq('status', data.status)
    if (data.search) {
      const like = `%${data.search}%`
      q = q.or(`full_name.ilike.${like},phone.ilike.${like},email.ilike.${like},code.ilike.${like}`)
    }

    const { data: rows, error } = await q
    if (error) {
      console.error('[listCustomers]', error)
      return []
    }
    return (rows ?? []) as Customer[]
  })

export const getCustomer = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown): { id: string } => {
    const v = raw as { id?: string }
    if (!v?.id) throw new Error('id required')
    return { id: v.id }
  })
  .handler(async ({ data, context }): Promise<{
    customer: Customer
    addresses: CustomerAddress[]
    contacts: CustomerContact[]
    tags: CustomerTag[]
  } | null> => {
    const { getActorFromSupabase, requirePermission } = await import('./session.server')
    const actor = await getActorFromSupabase(context.supabase, context.userId)
    requirePermission(actor, 'customer.read')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = context.supabase as any
    const { data: c, error } = await sb
      .from('crm_customers')
      .select(sel('*'))
      .eq('id', data.id)
      .eq('organization_id', actor.organizationId)
      .maybeSingle()
    if (error || !c) return null

    const [{ data: a }, { data: co }, { data: t }] = await Promise.all([
      sb.from('crm_customer_addresses').select(sel('*')).eq('customer_id', data.id).order('is_default', { ascending: false }),
      sb.from('crm_customer_contacts').select(sel('*')).eq('customer_id', data.id).order('is_primary', { ascending: false }),
      sb.from('crm_customer_tags').select(sel('*')).eq('customer_id', data.id).order('tag', { ascending: true }),
    ])

    return {
      customer: c as Customer,
      addresses: (a ?? []) as CustomerAddress[],
      contacts: (co ?? []) as CustomerContact[],
      tags: (t ?? []) as CustomerTag[],
    }
  })
