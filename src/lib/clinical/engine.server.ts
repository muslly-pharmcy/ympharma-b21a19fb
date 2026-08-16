// Clinical engine — orchestrates every adapter against a single (patient, drugs) input.
// Advisory: results are surfaced to the UI but never block business writes.

import type { ClinicalCheckInput, ClinicalWarning, DrugKnowledgeProvider } from '@/domain/clinical/types'
import { getProvider } from './registry.server'

export interface ClinicalCheckResult {
  providerId: string
  providerName: string
  warnings: ClinicalWarning[]
  ranAt: string
}

export async function runClinicalCheck(
  input: ClinicalCheckInput,
  providerId?: string,
): Promise<ClinicalCheckResult> {
  const provider: DrugKnowledgeProvider = getProvider(providerId ?? process.env.CLINICAL_PROVIDER)

  const results = await Promise.allSettled([
    provider.allergy.check(input),
    provider.interaction.check(input),
    provider.dose.check(input),
    provider.contraindication.check(input),
    provider.pregnancy.check(input),
    provider.renal.check(input),
    provider.hepatic.check(input),
  ])

  const warnings: ClinicalWarning[] = []
  for (const r of results) if (r.status === 'fulfilled') warnings.push(...r.value)

  const rank: Record<ClinicalWarning['severity'], number> = {
    critical: 0, high: 1, moderate: 2, low: 3, info: 4,
  }
  warnings.sort((a, b) => rank[a.severity] - rank[b.severity])

  return {
    providerId: provider.id,
    providerName: provider.displayName,
    warnings,
    ranAt: new Date().toISOString(),
  }
}
