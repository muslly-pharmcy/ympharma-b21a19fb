// Policy-driven model selection. No if/else on business identity.
// The router maps a *tier* + optional cost/latency hints to a concrete Gateway model id.
// Callers ask for a tier; the router chooses the model. This is what keeps the Brain
// model-agnostic: swapping a model = one row here.
import type { ModelTier } from './types'
export type { ModelTier } from './types'

interface RoutingCandidate {
  model: string
  tier: ModelTier
  costPerMTokenCents: number     // rough — feeds Budget Engine estimates
  avgLatencyMs: number           // rough — feeds Budget Engine and monitoring
  supportsVision: boolean
}

// Curated allowlist (must match ai-models-chat catalog).
const CATALOG: RoutingCandidate[] = [
  { model: 'google/gemini-3-flash-preview',  tier: 'fast',     costPerMTokenCents: 15,  avgLatencyMs: 900,  supportsVision: true  },
  { model: 'google/gemini-3.1-flash-lite',   tier: 'fast',     costPerMTokenCents: 8,   avgLatencyMs: 700,  supportsVision: true  },
  { model: 'google/gemini-3.5-flash',        tier: 'balanced', costPerMTokenCents: 25,  avgLatencyMs: 1400, supportsVision: true  },
  { model: 'google/gemini-2.5-pro',          tier: 'deep',     costPerMTokenCents: 120, avgLatencyMs: 3200, supportsVision: true  },
  { model: 'google/gemini-3.1-pro-preview',  tier: 'deep',     costPerMTokenCents: 140, avgLatencyMs: 3400, supportsVision: true  },
  { model: 'openai/gpt-5.4-nano',            tier: 'fast',     costPerMTokenCents: 20,  avgLatencyMs: 900,  supportsVision: true  },
  { model: 'openai/gpt-5.4-mini',            tier: 'balanced', costPerMTokenCents: 60,  avgLatencyMs: 1600, supportsVision: true  },
  { model: 'openai/gpt-5.5',                 tier: 'deep',     costPerMTokenCents: 250, avgLatencyMs: 4200, supportsVision: true  },
  // Vision tier — multimodal perception (prescriptions, lab results, scans).
  { model: 'google/gemini-3.5-flash',        tier: 'vision',   costPerMTokenCents: 25,  avgLatencyMs: 1600, supportsVision: true  },
  { model: 'google/gemini-2.5-pro',          tier: 'vision',   costPerMTokenCents: 120, avgLatencyMs: 3400, supportsVision: true  },
]


export interface RouteRequest {
  tier: ModelTier
  needsVision?: boolean
  maxLatencyMs?: number
  maxCostPerMTokenCents?: number
  prefer?: string                     // exact model pin (overrides router)
}

export interface RouteResult {
  model: string
  estimatedLatencyMs: number
  estimatedCostPerMTokenCents: number
  reason: string
}

export function routeModel(req: RouteRequest): RouteResult {
  if (req.prefer) {
    const pinned = CATALOG.find((c) => c.model === req.prefer)
    if (pinned) return { model: pinned.model, estimatedLatencyMs: pinned.avgLatencyMs, estimatedCostPerMTokenCents: pinned.costPerMTokenCents, reason: 'pinned' }
    // Pinned but unknown to router — still allow, with unknown estimates.
    return { model: req.prefer, estimatedLatencyMs: 0, estimatedCostPerMTokenCents: 0, reason: 'pinned-unknown' }
  }
  const filtered = CATALOG
    .filter((c) => c.tier === req.tier)
    .filter((c) => (req.needsVision ? c.supportsVision : true))
    .filter((c) => (req.maxLatencyMs ? c.avgLatencyMs <= req.maxLatencyMs : true))
    .filter((c) => (req.maxCostPerMTokenCents ? c.costPerMTokenCents <= req.maxCostPerMTokenCents : true))
  const pick = filtered.sort((a, b) => a.costPerMTokenCents - b.costPerMTokenCents)[0]
    ?? CATALOG.find((c) => c.tier === req.tier)!
  return { model: pick.model, estimatedLatencyMs: pick.avgLatencyMs, estimatedCostPerMTokenCents: pick.costPerMTokenCents, reason: 'policy' }
}

export const MODEL_CATALOG = CATALOG
