// Capability Registry — declares what each agent may do.
// Fallback (no row) = read-only + can_call_tools + can_learn — safe default.
import type { CapabilityRow } from './types'
import { z } from 'zod'

async function admin() {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  // Typed client — proxy preserves SupabaseClient<Database> typing.
  return supabaseAdmin
}

// Default caps: allow execute + tool calls. Safety layer, budget engine, and
// policy engine still gate every dispatch downstream; requiring an explicit
// air_capabilities row per (org, agent) was the top cause of "AI Kernel dead"
// in fresh orgs. Write/approve remain opt-in.
const DEFAULT: Omit<CapabilityRow, 'agent_key'> = {
  can_read: true,
  can_write: false,
  can_execute: true,
  can_call_tools: true,
  can_approve: false,
  can_learn: true,
  allowed_domains: [],
}

const capabilityRowSchema = z.object({
  agent_key: z.string().trim().min(1).max(128),
  can_read: z.boolean(),
  can_write: z.boolean(),
  can_execute: z.boolean(),
  can_call_tools: z.boolean(),
  can_approve: z.boolean(),
  can_learn: z.boolean(),
  allowed_domains: z.array(z.string().trim().min(1).max(255)).max(100),
}).strict()

/**
 * A capability lookup is a security boundary.  A failed database query is not
 * equivalent to a deliberately absent row: preserving the legacy no-row
 * defaults for a database outage would silently widen an agent's authority.
 */
export class CapabilityLookupError extends Error {
  constructor() {
    super('Unable to load AI capability policy')
    this.name = 'CapabilityLookupError'
  }
}

export function resolveCapabilityLookup(
  agentKey: string,
  result: { data: unknown; error: unknown },
): CapabilityRow {
  if (result.error) throw new CapabilityLookupError()
  if (result.data === null) return { agent_key: agentKey, ...DEFAULT }

  const parsed = capabilityRowSchema.safeParse(result.data)
  if (!parsed.success || parsed.data.agent_key !== agentKey) throw new CapabilityLookupError()
  return parsed.data
}

export async function loadCapabilities(orgId: string, agentKey: string): Promise<CapabilityRow> {
  const sb = await admin()
  const { data, error } = await sb.from('air_capabilities')
    .select('agent_key, can_read, can_write, can_execute, can_call_tools, can_approve, can_learn, allowed_domains')
    .eq('organization_id', orgId).eq('agent_key', agentKey).maybeSingle()
  return resolveCapabilityLookup(agentKey, { data, error })
}

export function requireCapability(caps: CapabilityRow, cap: keyof Omit<CapabilityRow, 'agent_key' | 'allowed_domains'>): void {
  if (!caps[cap]) throw new Error(`capability denied: ${caps.agent_key} lacks ${cap}`)
}
