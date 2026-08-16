// AI Runtime server functions — list agents, invoke agent, list runs.
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export const listAgents = createServerFn({ method: 'GET' }).handler(async () => {
  const { getActor } = await import('./session.server')
  await getActor()
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data, error } = await supabaseAdmin
    .from('air_agents')
    .select('key, display_name, description, model, allowed_tools, is_active')
    .eq('is_active', true)
    .order('display_name')
  if (error) throw new Error(error.message)
  return data ?? []
})

export const listAvailableToolsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { getActor } = await import('./session.server')
  await getActor()
  const { listAvailableTools } = await import('./ai/runtime.server')
  return listAvailableTools()
})

const invokeInput = z.object({
  agentKey: z.string().min(1),
  input: z.string().min(1).max(4000),
  toolInputs: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
})
export type InvokeAgentInput = z.infer<typeof invokeInput>

export const invokeAgent = createServerFn({ method: 'POST' })
  .validator((raw: unknown): InvokeAgentInput => invokeInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { audit } = await import('./audit.server')
    const { runAgent } = await import('./ai/runtime.server')
    const actor = await getActor()
    requirePermission(actor, 'ai.execute')
    const result = await runAgent(actor, data)
    await audit(actor, {
      action: 'ai.invoke',
      resourceType: 'ai_agent',
      resourceId: data.agentKey,
      payload: { run_id: result.runId, tools_used: result.toolsUsed, total_tokens: result.totalTokens },
    })
    return result
  })

export const listRuns = createServerFn({ method: 'GET' })
  .validator((raw: unknown) => z.object({ limit: z.number().int().min(1).max(100).optional() }).parse(raw ?? {}))
  .handler(async ({ data }) => {
    const { getActor } = await import('./session.server')
    const actor = await getActor()
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: rows, error } = await supabaseAdmin
      .from('air_runs')
      .select('id, agent_key, model, input, output, status, error_message, tools_used, total_tokens, latency_ms, created_at')
      .eq('organization_id', actor.organizationId)
      .order('created_at', { ascending: false })
      .limit(data.limit ?? 25)
    if (error) throw new Error(error.message)
    return rows ?? []
  })
