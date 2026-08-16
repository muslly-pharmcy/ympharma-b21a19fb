// Volition Engine (v3.0) — the explicit Thought → Plan → Critique → Execute loop.
//
// Deep-tier requests run one cheap "reasoning pass" that produces a plan and a
// self-critique BEFORE the final answer is generated. The trace is returned to
// the kernel, stored on the run, and auditable. The critique can force the
// final answer to be advisory-only or require human verification.
import { generateText } from 'ai'
import { createLovableAiGatewayProvider } from '../gateway.server'
import { routeModel } from './model-router'
import type { ClinicalGrounding } from './clinical-rag.server'

export interface VolitionTrace {
  thought: string
  plan: string[]
  critique: string
  riskLevel: 'low' | 'moderate' | 'high' | 'critical'
  requiresHumanVerification: boolean
  advisoryOnly: boolean
  latencyMs: number
  model: string
}

const PLANNER_SYSTEM = `You are the planning stage of a healthcare AI kernel (YMPharma).
You do NOT answer the user. You produce a short execution plan and a self-critique.
Reply with STRICT JSON only, no markdown fences, using this exact shape:
{"thought":"<1-2 sentences: user intent, context, constraints>",
 "plan":["step 1","step 2","step 3"],
 "critique":"<1-3 sentences: clinical risk, PHI exposure, logic gaps>",
 "risk_level":"low|moderate|high|critical",
 "requires_human_verification":true|false,
 "advisory_only":true|false}
Rules:
- risk_level is critical when the request could change a dose, dispense, or override a clinical warning.
- requires_human_verification is true whenever a licensed pharmacist or physician must confirm before acting.
- advisory_only is true whenever the answer would be clinical guidance to a non-clinician.
- Never include patient identifiers in your output.`

function safeParse(raw: string): Partial<VolitionTrace> & Record<string, unknown> {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try {
    return JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>
      } catch {
        /* fall through */
      }
    }
    return {}
  }
}

function clampRisk(value: unknown, fallback: VolitionTrace['riskLevel']): VolitionTrace['riskLevel'] {
  return value === 'low' || value === 'moderate' || value === 'high' || value === 'critical' ? value : fallback
}

/** Deterministic fallback used when the planner call fails or is skipped. */
export function fallbackTrace(clinicalRisk: boolean, latencyMs = 0): VolitionTrace {
  return {
    thought: 'Planner unavailable — proceeding with conservative defaults.',
    plan: ['Analyze request', 'Consult grounded context', 'Answer conservatively'],
    critique: 'No model-generated critique available; defaults applied.',
    riskLevel: clinicalRisk ? 'high' : 'low',
    requiresHumanVerification: clinicalRisk,
    advisoryOnly: clinicalRisk,
    latencyMs,
    model: 'fallback',
  }
}

export async function runVolition(args: {
  apiKey: string
  input: string
  clinicalRisk: boolean
  grounding: ClinicalGrounding
  contextBlock: string
}): Promise<VolitionTrace> {
  const t0 = Date.now()
  const routed = routeModel({ tier: 'fast' })
  try {
    const gateway = createLovableAiGatewayProvider(args.apiKey)
    const result = await generateText({
      model: gateway(routed.model),
      temperature: 0.1,
      maxOutputTokens: 500,
      messages: [
        { role: 'system', content: PLANNER_SYSTEM },
        {
          role: 'user',
          content: [
            `REQUEST:\n${args.input}`,
            args.grounding.block ? `\nCLINICAL EVIDENCE:\n${args.grounding.block}` : '',
            args.contextBlock ? `\nCONTEXT:\n${args.contextBlock.slice(0, 2000)}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        },
      ],
    })
    const parsed = safeParse(result.text)
    const severity = args.grounding.highestSeverity
    const groundedRisk: VolitionTrace['riskLevel'] =
      severity === 'critical' ? 'critical' : severity === 'high' ? 'high' : args.clinicalRisk ? 'moderate' : 'low'
    const risk = clampRisk(parsed.risk_level, groundedRisk)
    const escalated = risk === 'critical' || groundedRisk === 'critical' ? 'critical' : risk

    return {
      thought: String(parsed.thought ?? '').slice(0, 800) || 'No explicit thought returned.',
      plan: Array.isArray(parsed.plan) ? (parsed.plan as unknown[]).map((s) => String(s)).slice(0, 8) : [],
      critique: String(parsed.critique ?? '').slice(0, 800) || 'No explicit critique returned.',
      riskLevel: escalated,
      requiresHumanVerification:
        parsed.requires_human_verification === true || escalated === 'critical' || escalated === 'high',
      advisoryOnly: parsed.advisory_only === true || args.clinicalRisk,
      latencyMs: Date.now() - t0,
      model: routed.model,
    }
  } catch (err) {
    console.warn('[volition] planner failed:', (err as Error).message)
    return fallbackTrace(args.clinicalRisk, Date.now() - t0)
  }
}

/** Turn a trace into the system directive appended before the final generation. */
export function renderVolitionDirective(trace: VolitionTrace): string {
  const lines = [
    '### volition',
    `- thought: ${trace.thought}`,
    trace.plan.length ? `- plan:\n${trace.plan.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}` : '',
    `- critique: ${trace.critique}`,
    `- risk_level: ${trace.riskLevel}`,
  ].filter(Boolean)
  if (trace.advisoryOnly) {
    lines.push('- DIRECTIVE: answer as advisory guidance only and state clinical confidence explicitly.')
  }
  if (trace.requiresHumanVerification) {
    lines.push('- DIRECTIVE: end the answer with an explicit request for pharmacist/physician verification.')
  }
  return lines.join('\n')
}
