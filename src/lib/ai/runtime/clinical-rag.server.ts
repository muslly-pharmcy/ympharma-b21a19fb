// Clinical RAG (v3.0) — grounds clinical answers in the Clinical Engine
// (allergy / interaction / dose / contraindication / pregnancy / renal / hepatic)
// instead of the model's own recollection. The engine is advisory: it never
// blocks a write, but its output is injected into the prompt and echoed to the
// caller so every clinical statement carries verifiable evidence.
import type { ClinicalCheckInput, ClinicalWarning } from '@/domain/clinical/types'
import type { ClientRecord } from './ego-memory.server'

export interface ClinicalGrounding {
  ran: boolean
  providerId: string | null
  warnings: ClinicalWarning[]
  highestSeverity: ClinicalWarning['severity'] | null
  confidence: 'verified' | 'partial' | 'unverified'
  block: string
}

const SEVERITY_ORDER: Array<ClinicalWarning['severity']> = ['critical', 'high', 'moderate', 'low', 'info']

const EMPTY: ClinicalGrounding = {
  ran: false,
  providerId: null,
  warnings: [],
  highestSeverity: null,
  confidence: 'unverified',
  block: '',
}

/** Extract candidate drug mentions from free text using the client's history. */
export function extractDrugMentions(input: string, record: ClientRecord | null): string[] {
  const text = (input ?? '').toLowerCase()
  const known = record?.medicationHistory ?? []
  const fromHistory = known.filter((m) => m && text.includes(m.toLowerCase()))
  return Array.from(new Set(fromHistory)).slice(0, 12)
}

function renderGroundingBlock(providerId: string, warnings: ClinicalWarning[]): string {
  const lines = [`### clinical-rag (provider: ${providerId})`]
  if (warnings.length === 0) {
    lines.push('- no warnings returned by the clinical knowledge provider for the drugs supplied.')
    lines.push('- do NOT state that the combination is safe; state only that no warning was returned.')
  } else {
    for (const w of warnings.slice(0, 20)) {
      lines.push(`- [${w.severity.toUpperCase()}][${w.category}] ${w.message} (source: ${w.source})`)
    }
  }
  lines.push('- ground every clinical claim in the lines above; label anything else as unverified.')
  return lines.join('\n')
}

/**
 * Run the clinical engine for a client + a set of drug names.
 * Fail-soft: an engine error degrades to `unverified`, never throwing into the
 * kernel's happy path.
 */
export async function groundClinically(args: {
  record: ClientRecord | null
  drugNames: string[]
}): Promise<ClinicalGrounding> {
  const { record, drugNames } = args
  if (!record || drugNames.length === 0) return EMPTY

  const input: ClinicalCheckInput = {
    patient: {
      patientId: record.clientId,
      ageYears: null,
      sex: null,
      weightKg: null,
      pregnant: null,
      breastfeeding: null,
      renalFunctionEgfr: null,
      hepaticImpairment: null,
      knownAllergies: record.allergies.map((substance) => ({ substance, code: null })),
      activeConditions: record.chronicConditions.map((label) => ({ label, code: null })),
    },
    drugs: drugNames.map((name, idx) => ({
      itemId: `mention-${idx}`,
      productId: null,
      code: null,
      name,
    })),
  }

  try {
    const { runClinicalCheck } = await import('@/lib/clinical/engine.server')
    const res = await runClinicalCheck(input)
    const highest = SEVERITY_ORDER.find((s) => res.warnings.some((w) => w.severity === s)) ?? null
    return {
      ran: true,
      providerId: res.providerId,
      warnings: res.warnings,
      highestSeverity: highest,
      confidence: res.providerId === 'null' ? 'partial' : 'verified',
      block: renderGroundingBlock(res.providerId, res.warnings),
    }
  } catch (err) {
    console.warn('[clinical-rag] engine failed:', (err as Error).message)
    return EMPTY
  }
}
