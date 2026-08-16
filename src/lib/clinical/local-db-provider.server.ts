// Local knowledge provider — grounds clinical warnings in the project's own
// curated tables (`medical_entities`, `drug_interactions`, patient allergies)
// instead of inventing rules. Server-only: uses the admin client for lookups
// after the caller has already been authorized upstream.

import type {
  ClinicalCheckInput,
  ClinicalSeverity,
  ClinicalWarning,
  DrugKnowledgeProvider,
} from '@/domain/clinical/types'

const empty = { async check() { return [] as ClinicalWarning[] } }

/** drug_interactions.severity -> ClinicalSeverity */
const SEVERITY_MAP: Record<string, ClinicalSeverity> = {
  contraindicated: 'critical',
  major: 'high',
  moderate: 'moderate',
  minor: 'low',
}

export function normalizeName(value: string): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

interface EntityRow {
  id: string
  name_ar: string | null
  name_en: string | null
}

interface InteractionRow {
  drug_a_id: string
  drug_b_id: string
  severity: string
  mechanism: string | null
  clinical_effect_ar: string | null
  recommendation_ar: string | null
  evidence_source: string | null
}

/** Resolve prescribed drug names to curated medical_entities ids. */
async function resolveEntities(
  names: string[],
): Promise<Map<string, { entityId: string; label: string }>> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const resolved = new Map<string, { entityId: string; label: string }>()
  if (names.length === 0) return resolved

  const { data } = await supabaseAdmin
    .from('medical_entities')
    .select('id, name_ar, name_en')
    .eq('entity_type', 'drug')
    .limit(5000)

  const rows = (data ?? []) as EntityRow[]
  const index = new Map<string, { entityId: string; label: string }>()
  for (const row of rows) {
    const label = row.name_ar || row.name_en || ''
    for (const candidate of [row.name_ar, row.name_en]) {
      if (!candidate) continue
      index.set(normalizeName(candidate), { entityId: row.id, label })
    }
  }

  for (const name of names) {
    const key = normalizeName(name)
    if (!key) continue
    const direct = index.get(key)
    if (direct) {
      resolved.set(name, direct)
      continue
    }
    // token-prefix fallback: "Amoxicillin 500mg" -> "amoxicillin"
    const token = key.split(' ')[0]
    if (!token || token.length < 4) continue
    for (const [indexed, value] of index) {
      if (indexed === token || indexed.startsWith(`${token} `)) {
        resolved.set(name, value)
        break
      }
    }
  }

  return resolved
}

async function interactionCheck(input: ClinicalCheckInput): Promise<ClinicalWarning[]> {
  const drugs = input.drugs.filter((d) => d.name?.trim())
  if (drugs.length < 2) return []

  const resolved = await resolveEntities(drugs.map((d) => d.name))
  if (resolved.size < 2) return []

  const byEntity = new Map<string, { itemIds: string[]; label: string }>()
  for (const drug of drugs) {
    const hit = resolved.get(drug.name)
    if (!hit) continue
    const bucket = byEntity.get(hit.entityId) ?? { itemIds: [], label: hit.label }
    bucket.itemIds.push(drug.itemId)
    byEntity.set(hit.entityId, bucket)
  }

  const ids = Array.from(byEntity.keys())
  if (ids.length < 2) return []

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data } = await supabaseAdmin
    .from('drug_interactions')
    .select('drug_a_id, drug_b_id, severity, mechanism, clinical_effect_ar, recommendation_ar, evidence_source')
    .in('drug_a_id', ids)
    .in('drug_b_id', ids)

  const warnings: ClinicalWarning[] = []
  for (const raw of (data ?? []) as InteractionRow[]) {
    const a = byEntity.get(raw.drug_a_id)
    const b = byEntity.get(raw.drug_b_id)
    if (!a || !b) continue

    const severity = SEVERITY_MAP[raw.severity] ?? 'moderate'
    const effect = raw.clinical_effect_ar ?? raw.mechanism ?? 'تداخل دوائي محتمل'
    const advice = raw.recommendation_ar ? ` — التوصية: ${raw.recommendation_ar}` : ''

    warnings.push({
      category: 'interaction',
      severity,
      code: `local-di:${raw.drug_a_id}:${raw.drug_b_id}`,
      message: `تداخل بين «${a.label}» و«${b.label}»: ${effect}${advice}`,
      subjectItemIds: [...a.itemIds, ...b.itemIds],
      source: 'local-db',
      evidenceUrl: null,
    })
  }

  return warnings
}

async function allergyCheck(input: ClinicalCheckInput): Promise<ClinicalWarning[]> {
  const allergies = input.patient.knownAllergies
    .map((a) => normalizeName(a.substance))
    .filter(Boolean)
  if (allergies.length === 0) return []

  const warnings: ClinicalWarning[] = []
  for (const drug of input.drugs) {
    const name = normalizeName(drug.name)
    if (!name) continue
    const hit = allergies.find((a) => name.includes(a) || a.includes(name))
    if (!hit) continue
    warnings.push({
      category: 'allergy',
      severity: 'critical',
      code: `local-allergy:${hit}`,
      message: `المريض لديه حساسية مسجّلة تجاه «${hit}» وهي مطابقة للدواء «${drug.name}».`,
      subjectItemIds: [drug.itemId],
      source: 'local-db',
      evidenceUrl: null,
    })
  }
  return warnings
}

export const localDbProvider: DrugKnowledgeProvider = {
  id: 'local-db',
  displayName: 'قاعدة المعرفة الدوائية المحلية',
  allergy: { check: allergyCheck },
  interaction: { check: interactionCheck },
  dose: empty,
  contraindication: empty,
  pregnancy: empty,
  renal: empty,
  hepatic: empty,
}
