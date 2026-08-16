// Intent Router (v3.0) — decides *tier* from the request itself, before the
// Model Router picks a concrete model. Pure function: no I/O, no env, testable.
//
//   image / scan present            -> 'vision'
//   clinical or analytical language -> 'deep'   (Volition loop runs)
//   short operational question      -> 'fast'
//   everything else                 -> 'balanced'
import type { ModelTier } from './types'

export type IntentKind =
  | 'multimodal_clinical'
  | 'clinical_reasoning'
  | 'operational_analysis'
  | 'daily_operations'

export interface IntentDecision {
  intent: IntentKind
  tier: ModelTier
  clinicalRisk: boolean
  matched: string[]
  reason: string
}

// Arabic + English trigger vocabulary. Kept as data so adding a trigger is a
// one-line change (Constitution: no if/else on business identity).
const CLINICAL_TRIGGERS = [
  'تفاعل دوائي', 'تفاعلات', 'جرعة', 'الجرعة', 'تشخيص', 'خطة علاجية', 'علاج',
  'حساسية', 'موانع', 'حامل', 'الحمل', 'رضاعة', 'كلوي', 'كبدي', 'وصفة', 'أعراض جانبية',
  'interaction', 'contraindicat', 'dosage', 'dose', 'diagnos', 'prescription',
  'allergy', 'allergic', 'pregnan', 'renal', 'hepatic', 'side effect', 'therapy',
]

const ANALYTICAL_TRIGGERS = [
  'تحليل مخزون', 'تنبؤ', 'توقع', 'تقرير', 'مقارنة', 'اتجاه', 'خطة شراء', 'تحليل',
  'forecast', 'predict', 'analy', 'trend', 'report', 'compare', 'optimi',
]

const SHORT_QUERY_MAX = 120

function matches(haystack: string, needles: string[]): string[] {
  return needles.filter((n) => haystack.includes(n))
}

export function classifyIntent(input: string, opts: { hasImage?: boolean } = {}): IntentDecision {
  const text = (input ?? '').toLowerCase()
  const clinical = matches(text, CLINICAL_TRIGGERS)
  const analytical = matches(text, ANALYTICAL_TRIGGERS)

  if (opts.hasImage) {
    return {
      intent: 'multimodal_clinical',
      tier: 'vision',
      clinicalRisk: true,
      matched: clinical,
      reason: 'visual input requires the multimodal perception route',
    }
  }
  if (clinical.length > 0) {
    return {
      intent: 'clinical_reasoning',
      tier: 'deep',
      clinicalRisk: true,
      matched: clinical,
      reason: `clinical vocabulary detected (${clinical.slice(0, 3).join(', ')})`,
    }
  }
  if (analytical.length > 0) {
    return {
      intent: 'operational_analysis',
      tier: 'deep',
      clinicalRisk: false,
      matched: analytical,
      reason: `analytical vocabulary detected (${analytical.slice(0, 3).join(', ')})`,
    }
  }
  return {
    intent: 'daily_operations',
    tier: text.length <= SHORT_QUERY_MAX ? 'fast' : 'balanced',
    clinicalRisk: false,
    matched: [],
    reason: 'routine operational query',
  }
}

export const INTENT_TRIGGERS = { clinical: CLINICAL_TRIGGERS, analytical: ANALYTICAL_TRIGGERS }
