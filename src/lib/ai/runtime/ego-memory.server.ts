// Ego Memory (v3.0) — the unified "Client Record".
//
// Layered on air_memory_layers with scope_type='client' + scope_id=<clientId>.
// Clinical facts (allergies / conditions / medications) are read live from the
// patient tables; the memory rows hold interaction history and learned
// preferences. Every read filters organization_id, so nothing crosses tenants.
import { redactPII } from '../safety/pii-filter.server'

export interface ClientRecord {
  clientId: string
  displayName: string | null
  allergies: string[]
  chronicConditions: string[]
  medicationHistory: string[]
  preferences: Record<string, unknown>
  recentInteractions: string[]
}

async function admin() {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any
}

const MAX_INTERACTIONS = 8

function uniq(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((v): v is string => Boolean(v && v.trim()))))
}

/** Load the unified client record for a patient id (org-scoped, fail-soft). */
export async function loadClientRecord(orgId: string, clientId: string): Promise<ClientRecord | null> {
  const sb = await admin()
  const { data: patient } = await sb
    .from('hc_patients')
    .select('id, full_name, organization_id')
    .eq('id', clientId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!patient) return null

  const [allergiesRes, conditionsRes, rxRes, memRes] = await Promise.all([
    sb.from('patient_allergies').select('allergen').eq('patient_id', clientId),
    sb.from('patient_conditions').select('condition_name').eq('patient_id', clientId),
    sb
      .from('hc_prescription_items')
      .select('medication_name, hc_prescriptions!inner(patient_id)')
      .eq('hc_prescriptions.patient_id', clientId)
      .limit(25),
    sb
      .from('air_memory_layers')
      .select('content, importance, created_at, key')
      .eq('organization_id', orgId)
      .eq('scope_type', 'client')
      .eq('scope_id', clientId)
      .order('created_at', { ascending: false })
      .limit(MAX_INTERACTIONS * 2),
  ])

  const memRows = (memRes.data ?? []) as Array<{ content: string; key: string | null }>
  const preferences: Record<string, unknown> = {}
  const recentInteractions: string[] = []
  for (const row of memRows) {
    if (row.key?.startsWith('pref:')) preferences[row.key.slice(5)] = row.content
    else if (recentInteractions.length < MAX_INTERACTIONS) recentInteractions.push(row.content)
  }

  return {
    clientId,
    displayName: (patient as { full_name?: string | null }).full_name ?? null,
    allergies: uniq((allergiesRes.data ?? []).map((r: { allergen: string }) => r.allergen)),
    chronicConditions: uniq((conditionsRes.data ?? []).map((r: { condition_name: string }) => r.condition_name)),
    medicationHistory: uniq((rxRes.data ?? []).map((r: { medication_name: string }) => r.medication_name)),
    preferences,
    recentInteractions,
  }
}

/** Compact, PHI-redacted prompt block. Names/phones never reach the model. */
export function renderClientRecordBlock(rec: ClientRecord): string {
  const lines = [
    '### ego-memory:client-record',
    `- client_ref: ${rec.clientId.slice(0, 8)}…`,
    `- allergies: ${rec.allergies.join(', ') || 'none recorded'}`,
    `- chronic_conditions: ${rec.chronicConditions.join(', ') || 'none recorded'}`,
    `- medication_history: ${rec.medicationHistory.slice(0, 12).join(', ') || 'none recorded'}`,
  ]
  const prefKeys = Object.keys(rec.preferences)
  if (prefKeys.length) {
    lines.push(`- preferences: ${prefKeys.map((k) => `${k}=${String(rec.preferences[k])}`).join('; ')}`)
  }
  if (rec.recentInteractions.length) {
    lines.push('- recent_interactions:')
    for (const i of rec.recentInteractions) lines.push(`  · ${i}`)
  }
  return redactPII(lines.join('\n'))
}

/** Persist an interaction / preference into the client's ego memory. */
export async function rememberForClient(args: {
  organizationId: string
  clientId: string
  agentKey: string
  content: string
  key?: string
  importance?: number
  layer?: 'short' | 'working' | 'long'
}): Promise<void> {
  const sb = await admin()
  const layer = args.layer ?? 'long'
  const ttl = layer === 'short' ? 15 * 60_000 : layer === 'working' ? 24 * 60 * 60_000 : null
  await sb.from('air_memory_layers').insert({
    organization_id: args.organizationId,
    agent_key: args.agentKey,
    layer,
    scope_type: 'client',
    scope_id: args.clientId,
    key: args.key ?? null,
    content: redactPII(args.content).slice(0, 1000),
    importance: args.importance ?? 0.7,
    expires_at: ttl ? new Date(Date.now() + ttl).toISOString() : null,
  })
}
