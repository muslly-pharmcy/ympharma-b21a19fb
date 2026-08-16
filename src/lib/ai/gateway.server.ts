// Lovable AI Gateway provider (OpenAI-compatible).
// Read LOVABLE_API_KEY inside handlers — never at module scope.
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

const LOVABLE_AIG_RUN_ID_HEADER = 'X-Lovable-AIG-Run-ID'

function createRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined
  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      if (runId && !headers.has(LOVABLE_AIG_RUN_ID_HEADER)) {
        headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId)
      }
      const res = await fetch(input, { ...init, headers })
      const captured = res.headers.get(LOVABLE_AIG_RUN_ID_HEADER)?.trim()
      if (!runId && captured) runId = captured
      return res
    },
    getRunId: () => runId,
  }
}

export function createLovableAiGatewayProvider(lovableApiKey: string, initialRunId?: string) {
  const runIdFetch = createRunIdFetch(initialRunId)
  const provider = createOpenAICompatible({
    name: 'lovable',
    baseURL: 'https://ai.gateway.lovable.dev/v1',
    headers: {
      'Lovable-API-Key': lovableApiKey,
      'X-Lovable-AIG-SDK': 'vercel-ai-sdk',
    },
    fetch: runIdFetch.fetch,
  })
  return Object.assign(provider, { getRunId: runIdFetch.getRunId })
}
