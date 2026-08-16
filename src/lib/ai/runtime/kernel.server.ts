// Brain Kernel — the SINGLE orchestrator. Agents never talk to each other directly.
// Every request (user->agent or agent->agent) passes through kernel.dispatch which:
//   1. loads capabilities of the caller
//   2. runs Safety Layer preflight (input validation + policy eval)
//   3. checks Budget Engine
//   4. resolves prompt via Prompt Registry (approved-only)
//   5. resolves model via Model Router (tier-based)
//   6. builds tool-context via Tool Registry (with retries/timeouts)
//   7. appends Memory Manager short+working context
//   8. calls Lovable AI Gateway via generateText
//   9. persists run to air_runs, evaluation to air_evaluations, memory to air_memory_layers,
//      audit to air_kernel_calls
// The result is model-agnostic, policy-driven, observable, and reversible.
import { generateText } from 'ai'
import type { Actor } from '../../session.server'
import { createLovableAiGatewayProvider } from '../gateway.server'
import { getTool, listTools } from '../tools.server'
import { loadApprovedPrompt } from './prompt-registry.server'
import { routeModel, type ModelTier } from './model-router'
import { getToolMeta, runToolWithPolicy, validateToolInput } from './tool-registry.server'
import { CapabilityLookupError, loadCapabilities, requireCapability } from './capability-registry.server'
import { preflight } from './safety-layer.server'
import { checkBudgets, settleBudgets } from './budget-engine.server'
import { recordEvaluation } from './evaluation-engine.server'
import { buildContextBlock, remember } from './memory-manager.server'
import type { KernelCall } from './types'
import { classifyIntent, type IntentDecision } from './intent-router'
import { loadClientRecord, renderClientRecordBlock, rememberForClient, type ClientRecord } from './ego-memory.server'
import { extractDrugMentions, groundClinically } from './clinical-rag.server'
import { runVolition, renderVolitionDirective, type VolitionTrace } from './volition.server'
import { requestApproval, requiresApproval as hitlRequiresApproval, type HitlRisk } from './hitl.server'


interface AgentRow {
  key: string
  display_name: string
  prompt_key: string
  model: string | null
  allowed_tools: string[]
  temperature: number
  max_tokens: number
  is_active: boolean
}

export interface KernelDispatchInput {
  agentKey: string
  input: string
  toolInputs?: Record<string, Record<string, unknown>>
  fromAgent?: string | null
  tier?: ModelTier
  /** v3.0 — patient/customer whose Ego Memory record should be loaded. */
  clientId?: string | null
  /** v3.0 — set when the request carries an image/scan (multimodal route). */
  hasImage?: boolean
  /** v3.0 — action the caller intends to execute; gated actions go to HITL. */
  actionKey?: string | null
}

export interface KernelDispatchResult {
  runId: string
  output: string
  toolsUsed: string[]
  totalTokens: number | null
  latencyMs: number
  model: string
  decision: { allowed: boolean; policyKey?: string }
  /** v3.0 observability */
  intent?: IntentDecision
  volition?: VolitionTrace | null
  clinical?: { ran: boolean; providerId: string | null; confidence: string; warnings: number; highestSeverity: string | null }
  approvalId?: string | null
  requiresApproval?: boolean
}


async function admin() {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  // Typed client — proxy preserves SupabaseClient<Database> typing.
  return supabaseAdmin
}

async function auditKernelCall(actor: Actor, call: KernelCall, allowed: boolean, extras: { policyKey?: string; deniedReason?: string; decision?: Record<string, unknown> }) {
  const sb = await admin()
  await sb.from('air_kernel_calls').insert({
    organization_id: actor.organizationId,
    correlation_id: actor.correlationId,
    from_agent: call.fromAgent,
    to_agent: call.toAgent,
    purpose: call.purpose,
    allowed,
    decision: (extras.decision ?? {}) as never,
    policy_key: extras.policyKey ?? null,
    denied_reason: extras.deniedReason ?? null,
  })
}

async function loadAgent(agentKey: string): Promise<AgentRow> {
  const sb = await admin()
  const { data, error } = await sb.from('air_agents').select('*').eq('key', agentKey).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data || !data.is_active) throw new Error(`agent not found or inactive: ${agentKey}`)
  return data as unknown as AgentRow
}

function emergencyResponse(reason: string, t0: number): KernelDispatchResult {
  return {
    runId: `emergency-${crypto.randomUUID()}`,
    output:
      '⚠️ نظام الذكاء الاصطناعي في وضع الطوارئ حالياً وتعذّر الوصول لطبقة الحوكمة. حاول مجدداً بعد قليل — تم تسجيل الحادثة.',
    toolsUsed: [],
    totalTokens: null,
    latencyMs: Date.now() - t0,
    model: 'emergency-fallback',
    decision: { allowed: false, policyKey: `emergency:${reason.slice(0, 60)}` },
  }
}

export async function dispatch(actor: Actor, req: KernelDispatchInput): Promise<KernelDispatchResult> {
  const apiKey = process.env.LOVABLE_API_KEY
  if (!apiKey) throw new Error('Missing LOVABLE_API_KEY')

  const t0 = Date.now()
  const call: KernelCall = {
    fromAgent: req.fromAgent ?? null,
    toAgent: req.agentKey,
    purpose: 'invoke',
    context: { tier: req.tier ?? 'balanced' },
  }

  // 1. Load agent + capabilities (Survival Mode: infrastructure failure → safe fallback,
  //    but preserve throw semantics for business errors like "agent not found").
  let agent: AgentRow
  try {
    agent = await loadAgent(req.agentKey)
  } catch (err) {
    const msg = (err as Error).message
    const isInfraFailure =
      /fetch failed|ECONNREFUSED|ETIMEDOUT|network|Failed to fetch|503|504/i.test(msg)
    if (isInfraFailure) {
      console.warn(`[Kernel] Survival mode engaged — DB unreachable: ${msg}`)
      return emergencyResponse('db_unreachable', t0)
    }
    throw err
  }
  let caps
  try {
    caps = await loadCapabilities(actor.organizationId, agent.key)
  } catch (err) {
    // Never continue with stale or implicit authority when the capability
    // registry cannot be read. The emergency response does not invoke a
    // model, tool, memory store, or privileged database operation.
    if (err instanceof CapabilityLookupError) {
      console.warn('[Kernel] capability registry unavailable; denying dispatch')
      return emergencyResponse('capability_registry_unavailable', t0)
    }
    throw err
  }
  requireCapability(caps, 'can_execute')

  // 2. Safety pre-flight
  const safety = await preflight(actor, call, req.input)
  if (!safety.ok) {
    await auditKernelCall(actor, call, false, { policyKey: safety.decision.policyKey, deniedReason: safety.decision.deniedReason })
    throw new Error(safety.decision.deniedReason ?? 'blocked by safety layer')
  }

  // 3. Budget check
  const budget = await checkBudgets(actor.organizationId, agent.key)
  if (!budget.allowed) {
    await auditKernelCall(actor, call, false, { deniedReason: budget.deniedReason })
    throw new Error(budget.deniedReason ?? 'budget exhausted')
  }

  // 4. Prompt registry (approved-only) — fallback: air_prompts row via direct read if legacy prompt has no status column.
  const prompt = await loadApprovedPrompt(agent.prompt_key)

  // 5. Intent Router (v3.0) → tier, then Model Router → concrete model.
  const intent = classifyIntent(safety.redactedInput ?? req.input, { hasImage: req.hasImage })
  const tier = req.tier ?? intent.tier
  call.context = { ...call.context, tier, intent: intent.intent }
  const routed = routeModel({
    tier,
    needsVision: tier === 'vision',
    prefer: tier === 'vision' ? undefined : agent.model ?? undefined,
  })

  // 6. Tool context (only allowed + capability-checked + policied)
  const toolsUsed: string[] = []
  const toolChunks: string[] = []
  if (caps.can_call_tools) {
    const allowedToolKeys = new Set(agent.allowed_tools ?? [])
    // Fail closed instead of silently ignoring a caller-supplied tool name.
    // This prevents an untrusted client payload from becoming an accidental
    // capability probe when new tools are added later.
    for (const key of Object.keys(req.toolInputs ?? {})) {
      if (!allowedToolKeys.has(key)) throw new Error(`tool is not allowed for agent: ${key}`)
      validateToolInput(key, req.toolInputs![key])
    }
    for (const key of agent.allowed_tools ?? []) {
      const def = getTool(key)
      const meta = getToolMeta(key)
      if (!def || !meta) continue
      const input = req.toolInputs?.[key] ?? {}
      // Skip tools that need explicit input.
      const requiresInput = key === 'search_products' || key === 'get_product_stock'
      if (requiresInput && Object.keys(input).length === 0) continue
      try {
        const res = await runToolWithPolicy(def, { actor }, input)
        toolsUsed.push(key)
        toolChunks.push(`### tool:${key}\n${JSON.stringify(res, null, 2)}`)
      } catch (err) {
        toolChunks.push(`### tool:${key}\n${JSON.stringify({ ok: false, error: (err as Error).message })}`)
      }
    }
  }

  // 7. Memory context — agent memory + Ego Memory client record.
  const memBlock = caps.can_learn ? await buildContextBlock(actor.organizationId, agent.key) : ''
  let clientRecord: ClientRecord | null = null
  if (req.clientId) {
    try {
      clientRecord = await loadClientRecord(actor.organizationId, req.clientId)
    } catch (err) {
      console.warn('[Kernel] ego-memory unavailable:', (err as Error).message)
    }
  }
  const egoBlock = clientRecord ? renderClientRecordBlock(clientRecord) : ''

  // 7b. Clinical RAG grounding — evidence before generation, never after.
  const grounding = intent.clinicalRisk
    ? await groundClinically({
        record: clientRecord,
        drugNames: extractDrugMentions(safety.redactedInput ?? req.input, clientRecord),
      })
    : { ran: false, providerId: null, warnings: [], highestSeverity: null, confidence: 'unverified' as const, block: '' }

  const contextBlock = [memBlock, egoBlock, grounding.block, toolChunks.join('\n\n')]
    .filter(Boolean)
    .join('\n\n')

  // 7c. Volition loop — Thought → Plan → Critique before Execution (deep/vision only).
  const volition: VolitionTrace | null =
    tier === 'deep' || tier === 'vision'
      ? await runVolition({
          apiKey,
          input: safety.redactedInput ?? req.input,
          clinicalRisk: intent.clinicalRisk,
          grounding,
          contextBlock,
        })
      : null

  // 7d. Human-in-the-loop gate — high-risk actions never execute autonomously.
  const riskLevel: HitlRisk = volition?.riskLevel ?? (intent.clinicalRisk ? 'moderate' : 'low')
  const needsApproval = hitlRequiresApproval({ actionKey: req.actionKey, riskLevel })

  // 8. Insert run
  const sb = await admin()
  const { data: runIns, error: runErr } = await sb.from('air_runs').insert({
    organization_id: actor.organizationId,
    actor_user_id: actor.userId,
    agent_key: agent.key,
    model: routed.model,
    input: safety.redactedInput ?? req.input,
    status: 'pending',
    tools_used: toolsUsed,
    correlation_id: actor.correlationId,
    metadata: {
      tier,
      intent: intent.intent,
      intent_reason: intent.reason,
      clinical: {
        ran: grounding.ran,
        provider: grounding.providerId,
        confidence: grounding.confidence,
        warnings: grounding.warnings.length,
        highest_severity: grounding.highestSeverity,
      },
      volition: volition
        ? {
            thought: volition.thought,
            plan: volition.plan,
            critique: volition.critique,
            risk_level: volition.riskLevel,
            requires_human_verification: volition.requiresHumanVerification,
            advisory_only: volition.advisoryOnly,
            model: volition.model,
            latency_ms: volition.latencyMs,
          }
        : null,
      requires_approval: needsApproval,
    } as never,
  }).select('id').single()
  if (runErr) throw new Error(runErr.message)
  const runId = runIns.id as string

  let approvalId: string | null = null
  if (needsApproval) {
    approvalId = await requestApproval({
      organizationId: actor.organizationId,
      runId,
      agentKey: agent.key,
      actionKey: req.actionKey ?? `agent:${agent.key}`,
      riskLevel,
      reason: volition?.critique ?? intent.reason,
      payload: { intent: intent.intent, tier, tools: toolsUsed },
      requestedBy: actor.userId,
      correlationId: actor.correlationId,
    })
  }

  try {
    const gateway = createLovableAiGatewayProvider(apiKey)
    const model = gateway(routed.model)
    const messages = [
      { role: 'system' as const, content: prompt.system_prompt },
      ...(volition ? [{ role: 'system' as const, content: renderVolitionDirective(volition) }] : []),
      ...(contextBlock ? [{ role: 'system' as const, content: `Runtime context:\n\n${contextBlock}` }] : []),
      { role: 'user' as const, content: safety.redactedInput ?? req.input },
    ]

    const result = await generateText({
      model,
      messages,
      temperature: agent.temperature,
      maxOutputTokens: agent.max_tokens,
    })

    let output = result.text
    if (needsApproval) {
      output = `${output}\n\n---\n⏸️ **بانتظار موافقة بشرية** — هذا الإجراء مصنّف (${riskLevel}) ولن يُنفَّذ تلقائياً. تم إنشاء طلب اعتماد في قائمة الموافقات.`
    }
    const usage = result.usage as { inputTokens?: number; outputTokens?: number; totalTokens?: number } | undefined
    const latency = Date.now() - t0
    const totalTokens = usage?.totalTokens ?? null
    const costCents = totalTokens ? Math.ceil((totalTokens / 1_000_000) * routed.estimatedCostPerMTokenCents) : 0

    // 9. Persist run success + evaluation + budget settlement + audit + memory (if allowed)
    await Promise.all([
      sb.from('air_runs').update({
        status: 'success',
        output,
        prompt_tokens: usage?.inputTokens ?? null,
        completion_tokens: usage?.outputTokens ?? null,
        total_tokens: totalTokens,
        latency_ms: latency,
      }).eq('id', runId),
      recordEvaluation({
        organizationId: actor.organizationId,
        runId,
        latencyMs: latency,
        costCents,
        success: true,
      }),
      settleBudgets(actor.organizationId, agent.key, totalTokens ?? 0, costCents),
      auditKernelCall(actor, call, true, {
        decision: { model: routed.model, tools: toolsUsed, tier, intent: intent.intent, risk: riskLevel },
      }),
      caps.can_learn
        ? remember({
            organizationId: actor.organizationId,
            agentKey: agent.key,
            layer: 'short',
            content: `Q: ${req.input.slice(0, 200)} | A: ${output.slice(0, 200)}`,
            importance: 0.6,
          })
        : Promise.resolve(),
      clientRecord
        ? rememberForClient({
            organizationId: actor.organizationId,
            clientId: clientRecord.clientId,
            agentKey: agent.key,
            content: `[${intent.intent}] ${req.input.slice(0, 160)} → ${output.slice(0, 200)}`,
            importance: intent.clinicalRisk ? 0.85 : 0.6,
            layer: 'long',
          })
        : Promise.resolve(),
    ])

    return {
      runId,
      output,
      toolsUsed,
      totalTokens,
      latencyMs: latency,
      model: routed.model,
      decision: { allowed: true },
      intent,
      volition,
      clinical: {
        ran: grounding.ran,
        providerId: grounding.providerId,
        confidence: grounding.confidence,
        warnings: grounding.warnings.length,
        highestSeverity: grounding.highestSeverity,
      },
      approvalId,
      requiresApproval: needsApproval,
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await Promise.all([
      sb.from('air_runs').update({ status: 'error', error_message: msg, latency_ms: Date.now() - t0 }).eq('id', runId),
      recordEvaluation({
        organizationId: actor.organizationId,
        runId,
        latencyMs: Date.now() - t0,
        success: false,
        feedback: { error: msg },
      }),
      auditKernelCall(actor, call, false, { deniedReason: msg }),
    ])
    const wrappedError = new Error(msg) as Error & { cause?: unknown }
    wrappedError.cause = err
    throw wrappedError
  }
}

export function kernelListTools() {
  return listTools().map((t) => {
    const m = getToolMeta(t.key)
    return {
      key: t.key,
      description: t.description,
      capability: m?.capability ?? null,
      owner: m?.owner ?? null,
      version: m?.version ?? null,
    }
  })
}
