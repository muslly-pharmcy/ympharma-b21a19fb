// Human-in-the-loop (v3.0) — high-risk actions never execute straight from the
// kernel. They land in air_hitl_approvals and wait for a licensed human.
export type HitlRisk = 'low' | 'moderate' | 'high' | 'critical'
export type HitlStatus = 'pending' | 'approved' | 'rejected' | 'expired'

export interface HitlRequest {
  organizationId: string
  runId?: string | null
  agentKey: string
  actionKey: string
  riskLevel: HitlRisk
  reason: string
  payload?: Record<string, unknown>
  requestedBy?: string | null
  correlationId?: string | null
}

// Action keys that ALWAYS require a human decision, whatever the model says.
const ALWAYS_GATED = [
  'dispense.create',
  'dispense.complete',
  'inventory.adjust',
  'inventory.transfer',
  'prescription.update',
  'prescription.dispense',
  'order.high_value',
  'clinical.override',
]

export function isGatedAction(actionKey: string): boolean {
  return ALWAYS_GATED.includes(actionKey)
}

export function requiresApproval(args: { actionKey?: string | null; riskLevel: HitlRisk }): boolean {
  if (args.actionKey && isGatedAction(args.actionKey)) return true
  return args.riskLevel === 'critical'
}

async function admin() {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any
}

export async function requestApproval(req: HitlRequest): Promise<string | null> {
  const sb = await admin()
  const { data, error } = await sb
    .from('air_hitl_approvals')
    .insert({
      organization_id: req.organizationId,
      run_id: req.runId ?? null,
      agent_key: req.agentKey,
      action_key: req.actionKey,
      risk_level: req.riskLevel,
      reason: req.reason.slice(0, 1000),
      payload: req.payload ?? {},
      requested_by: req.requestedBy ?? null,
      correlation_id: req.correlationId ?? null,
    })
    .select('id')
    .maybeSingle()
  if (error) {
    console.warn('[hitl] failed to queue approval:', error.message)
    return null
  }
  return (data as { id: string } | null)?.id ?? null
}

export async function listApprovals(orgId: string, status: HitlStatus | 'all' = 'pending', limit = 50) {
  const sb = await admin()
  let qb = sb
    .from('air_hitl_approvals')
    .select('id, run_id, agent_key, action_key, risk_level, reason, payload, status, requested_by, decided_by, decided_at, decision_note, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (status !== 'all') qb = qb.eq('status', status)
  const { data, error } = await qb
  if (error) throw new Error(error.message)
  return (data ?? []) as Array<Record<string, unknown>>
}

export async function decideApproval(args: {
  organizationId: string
  approvalId: string
  decidedBy: string
  approve: boolean
  note?: string
}): Promise<void> {
  const sb = await admin()
  const { error } = await sb
    .from('air_hitl_approvals')
    .update({
      status: args.approve ? 'approved' : 'rejected',
      decided_by: args.decidedBy,
      decided_at: new Date().toISOString(),
      decision_note: args.note?.slice(0, 500) ?? null,
    })
    .eq('id', args.approvalId)
    .eq('organization_id', args.organizationId)
    .eq('status', 'pending')
  if (error) throw new Error(error.message)
}
