// Memory Manager — short/working/long/archive layers.
// Short: this-request scratch (TTL minutes). Working: this-day. Long: persistent.
// Archive: cold storage (never surfaced to prompt context automatically).
export type MemoryLayer = 'short' | 'working' | 'long' | 'archive'

const TTL_MS: Record<MemoryLayer, number | null> = {
  short:   15 * 60 * 1000,          // 15 min
  working: 24 * 60 * 60 * 1000,     // 1 day
  long:    null,                     // no expiry
  archive: null,                     // no expiry
}

async function admin() {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  // Typed client — proxy preserves SupabaseClient<Database> typing.
  return supabaseAdmin
}

export interface MemoryWrite {
  organizationId: string
  agentKey: string
  layer: MemoryLayer
  content: string
  key?: string
  importance?: number
}

export async function remember(rec: MemoryWrite): Promise<void> {
  const sb = await admin()
  const ttl = TTL_MS[rec.layer]
  const expires_at = ttl ? new Date(Date.now() + ttl).toISOString() : null
  await sb.from('air_memory_layers').insert({
    organization_id: rec.organizationId,
    agent_key: rec.agentKey,
    layer: rec.layer,
    key: rec.key ?? null,
    content: rec.content,
    importance: rec.importance ?? 0.5,
    expires_at,
  })
}

export async function recall(orgId: string, agentKey: string, layer: MemoryLayer, limit = 10): Promise<Array<{ content: string; created_at: string; importance: number }>> {
  const sb = await admin()
  const { data } = await sb.from('air_memory_layers')
    .select('content, created_at, importance, expires_at')
    .eq('organization_id', orgId).eq('agent_key', agentKey).eq('layer', layer)
    .order('created_at', { ascending: false }).limit(limit)
  const now = Date.now()
  return ((data ?? []) as Array<{ content: string; created_at: string; importance: number; expires_at: string | null }>)
    .filter((r) => !r.expires_at || new Date(r.expires_at).getTime() > now)
    .map((r) => ({ content: r.content, created_at: r.created_at, importance: r.importance }))
}

// Prompt-context helper: pull short+working memory as a compact block.
export async function buildContextBlock(orgId: string, agentKey: string): Promise<string> {
  const [short, working] = await Promise.all([
    recall(orgId, agentKey, 'short', 5),
    recall(orgId, agentKey, 'working', 5),
  ])
  if (short.length === 0 && working.length === 0) return ''
  const lines: string[] = []
  if (short.length) lines.push('### memory:short\n' + short.map((m) => `- ${m.content}`).join('\n'))
  if (working.length) lines.push('### memory:working\n' + working.map((m) => `- ${m.content}`).join('\n'))
  return lines.join('\n\n')
}
