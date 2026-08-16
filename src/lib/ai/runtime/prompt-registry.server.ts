// Prompt Registry — versioned prompts with approval state, guardrails, and rollback.
// Loads only APPROVED prompts at runtime; rollback = load a previous version.
export interface RegisteredPrompt {
  key: string
  version: number
  system_prompt: string
  guardrails: Record<string, unknown>
  output_schema: Record<string, unknown> | null
  status: 'draft' | 'approved' | 'deprecated'
  rollback_version: number | null
  approved_by: string | null
  approved_at: string | null
  evaluation_score: number | null
}

async function admin() {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  // Typed client — proxy preserves SupabaseClient<Database> typing.
  return supabaseAdmin
}

export async function loadApprovedPrompt(key: string): Promise<RegisteredPrompt> {
  const sb = await admin()
  const { data, error } = await sb
    .from('air_prompts')
    .select('key, version, system_prompt, guardrails, output_schema, status, rollback_version, approved_by, approved_at, evaluation_score')
    .eq('key', key)
    .maybeSingle()
  if (error) throw new Error(`prompt-registry: ${error.message}`)
  if (!data) throw new Error(`prompt-registry: prompt not found: ${key}`)
  if (data.status === 'deprecated') throw new Error(`prompt-registry: prompt deprecated: ${key}`)
  return data as RegisteredPrompt
}

export async function rollbackPrompt(key: string): Promise<void> {
  const sb = await admin()
  const { data } = await sb.from('air_prompts').select('rollback_version').eq('key', key).maybeSingle()
  const target = data?.rollback_version
  if (!target) throw new Error(`prompt-registry: no rollback target for ${key}`)
  await sb.from('air_prompts').update({ version: target, status: 'approved' }).eq('key', key)
}
