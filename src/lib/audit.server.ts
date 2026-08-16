import type { Actor } from './session.server'

export interface AuditEntry {
  action: string
  resourceType: string
  resourceId?: string | null
  payload?: Record<string, unknown>
}

/**
 * Write one row to public.audit_events using the service-role client.
 * Never throws to callers — audit must not break a successful mutation.
 */
export async function audit(actor: Actor, entry: AuditEntry): Promise<void> {
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    await supabaseAdmin.from('audit_events').insert({
      actor_user_id: actor.userId,
      organization_id: actor.organizationId,
      branch_id: actor.branchId,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId ?? null,
      ip: actor.ip,
      user_agent: actor.userAgent,
      correlation_id: actor.correlationId,
      payload: (entry.payload ?? {}) as unknown as never,
    })
  } catch (err) {
    console.error('[audit]', err)
  }
}
