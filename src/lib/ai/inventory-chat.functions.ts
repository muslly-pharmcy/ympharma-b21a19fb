// Thin server-fn wrapper around the Brain Kernel for the inventory chat UI.
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const input = z.object({
  message: z.string().trim().min(1).max(2000),
})

export const askInventoryAgent = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => input.parse(raw))
  .handler(async ({ data }) => {
    const { getActor } = await import('@/lib/session.server')
    const { dispatch } = await import('@/lib/ai/runtime/kernel.server')
    const actor = await getActor()
    const res = await dispatch(actor, {
      agentKey: 'catalog_advisor',
      input: data.message,
      // Feed the user's message to the search tool so the kernel can enrich
      // context automatically (agent's allowed_tools also includes low-stock
      // and expiring-soon which run without input).
      toolInputs: {
        search_products: { query: data.message, limit: 8 },
      },
    })
    return {
      output: res.output,
      runId: res.runId,
      toolsUsed: res.toolsUsed,
      latencyMs: res.latencyMs,
      model: res.model,
    }
  })
