// Safety Layer — pre/post pipeline around any agent execution.
// Order: Input Validation -> Policy Check -> Tool Permission -> Human Approval -> Execution -> Audit
import type { Actor } from '../../session.server'
import type { KernelCall, KernelDecision } from './types'
import { evaluatePolicy } from './policy-engine.server'
import { redactPII } from '../../ai/safety/pii-filter.server'

const MAX_INPUT = 8000
const SUSPECT = [/ignore previous instructions/i, /system prompt/i, /reveal the secret/i]

export interface SafetyOutcome {
  ok: boolean
  redactedInput?: string
  decision: KernelDecision
}

export async function preflight(actor: Actor, call: KernelCall, input: string): Promise<SafetyOutcome> {
  // 1. Input validation
  if (!input || input.length === 0) {
    return { ok: false, decision: { allowed: false, deniedReason: 'empty input' } }
  }
  if (input.length > MAX_INPUT) {
    return { ok: false, decision: { allowed: false, deniedReason: `input exceeds ${MAX_INPUT} chars` } }
  }
  let redacted = input
  for (const rx of SUSPECT) {
    redacted = redacted.replace(rx, '[filtered]')
  }
  // The resulting string is persisted in air_runs and sent to the provider.
  // Remove direct identifiers before either boundary; patient data is retrieved
  // separately through scoped tools and is already minimized for that purpose.
  redacted = redactPII(redacted)
  // 2. Policy check
  const decision = await evaluatePolicy(actor, call, `agent.${call.purpose}`)
  return { ok: decision.allowed, redactedInput: redacted, decision }
}
