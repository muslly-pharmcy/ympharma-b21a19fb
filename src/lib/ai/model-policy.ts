// Task-based model routing for the direct OpenAI path.
// One place decides which model runs which job. Never hardcode a model at a call site.
//
// Model ids verified against the account's /v1/models catalog.

export type AiTask =
  | 'classify' // intent detection, FAQ routing, language detection
  | 'assist' // normal patient / pharmacy assistance
  | 'clinical' // clinical reasoning, interaction interpretation
  | 'vision' // medicine box / prescription image understanding
  | 'bulk' // high-volume repetitive generation (descriptions, tags)
  | 'marketing' // Arabic marketing copy drafting

export interface ModelPolicy {
  model: string
  reasoning?: { effort: 'low' | 'medium' | 'high' }
  maxOutputTokens: number
  /** Rough cost weight used for budget estimates and dashboards. */
  costWeight: number
}

const POLICY: Record<AiTask, ModelPolicy> = {
  classify: { model: 'gpt-5.6-luna', maxOutputTokens: 256, costWeight: 1 },
  assist: { model: 'gpt-5.6-terra', maxOutputTokens: 900, costWeight: 3 },
  clinical: {
    model: 'gpt-5.6-sol',
    reasoning: { effort: 'medium' },
    maxOutputTokens: 1400,
    costWeight: 8,
  },
  vision: { model: 'gpt-5.6-terra', maxOutputTokens: 900, costWeight: 4 },
  bulk: { model: 'gpt-5.6-luna', maxOutputTokens: 500, costWeight: 1 },
  marketing: { model: 'gpt-5.6-terra', maxOutputTokens: 1200, costWeight: 3 },
}

export function modelFor(task: AiTask): ModelPolicy {
  return POLICY[task]
}

/** Cheaper tier used when the primary model fails with a retryable error. */
export function fallbackFor(task: AiTask): ModelPolicy {
  if (task === 'clinical') return { model: 'gpt-5.6-terra', maxOutputTokens: 1000, costWeight: 3 }
  return { model: 'gpt-5.6-luna', maxOutputTokens: 600, costWeight: 1 }
}

export const MODEL_POLICY = POLICY
