// Policy Engine — declarative deny/require rules matched against Kernel calls.
// Loads org-scoped rules from air_policies (higher priority first); the first
// matching rule wins. Empty ruleset = allow.
import type { KernelCall, KernelDecision, PolicyRow } from './types'
import type { Actor } from '../../session.server'

async function admin() {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  // Typed client — proxy preserves SupabaseClient<Database> typing.
  return supabaseAdmin
}

// tiny cache: 30s per-org so repeated calls in one request are cheap.
const CACHE = new Map<string, { at: number; rows: PolicyRow[] }>()
const TTL = 30_000

async function loadPolicies(orgId: string, subject: string): Promise<PolicyRow[]> {
  const cacheKey = `${orgId}::${subject}`
  const hit = CACHE.get(cacheKey)
  if (hit && Date.now() - hit.at < TTL) return hit.rows
  const sb = await admin()
  const { data } = await sb.from('air_policies')
    .select('key, subject, rule, priority, is_active')
    .eq('organization_id', orgId).eq('subject', subject).eq('is_active', true)
    .order('priority', { ascending: true })
  const rows = (data ?? []) as PolicyRow[]
  CACHE.set(cacheKey, { at: Date.now(), rows })
  return rows
}

function matches(when: Record<string, unknown> | undefined, ctx: Record<string, unknown>): boolean {
  if (!when || Object.keys(when).length === 0) return true
  for (const [k, v] of Object.entries(when)) {
    if (ctx[k] !== v) return false
  }
  return true
}

export async function evaluatePolicy(actor: Actor, call: KernelCall, subject: string): Promise<KernelDecision> {
  const rows = await loadPolicies(actor.organizationId, subject)
  for (const row of rows) {
    if (!matches(row.rule.when, call.context)) continue
    if (row.rule.deny) {
      return { allowed: false, deniedReason: row.rule.reason ?? 'denied by policy', policyKey: row.key }
    }
    const req = row.rule.require ?? []
    for (const need of req) {
      if (need === 'human_approval') {
        return { allowed: false, deniedReason: 'requires human approval', policyKey: row.key, requiresApproval: true }
      }
      if (need.startsWith('role:')) {
        const role = need.slice(5)
        if (!actor.roles.includes(role) && actor.orgRole !== role) {
          return { allowed: false, deniedReason: `requires role ${role}`, policyKey: row.key }
        }
      }
    }
  }
  return { allowed: true }
}
