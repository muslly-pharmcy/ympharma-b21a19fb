import { describe, it, expect } from 'vitest'
import { runClinicalCheck } from '@/lib/clinical/engine.server'
import { registerProvider, getProvider } from '@/lib/clinical/registry.server'
import { nullProvider } from '@/lib/clinical/null-provider'
import type { DrugKnowledgeProvider, ClinicalWarning } from '@/domain/clinical/types'

describe('Clinical framework', () => {
  it('null provider returns zero warnings — never invents rules', async () => {
    const r = await runClinicalCheck({
      patient: { patientId: 'p1', knownAllergies: [{ substance: 'penicillin' }], activeConditions: [] },
      drugs: [{ itemId: 'i1', productId: null, code: null, name: 'Amoxicillin' }],
    }, 'null')
    expect(r.providerId).toBe('null')
    expect(r.warnings).toEqual([])
  })

  it('registry returns null provider for unknown id', () => {
    // Explicitly requested but unknown provider must NOT fall back to another
    // clinical data source — it degrades to the null provider (zero warnings).
    expect(getProvider('does-not-exist').id).toBe('null')
    expect(getProvider('null').id).toBe(nullProvider.id)
    // Unset provider keeps the curated local knowledge base as the default.
    expect(getProvider(undefined).id).toBe('local-db')
  })


  it('warnings sort by severity when a provider emits them', async () => {
    const stub: DrugKnowledgeProvider = {
      id: 'stub-test', displayName: 'stub',
      allergy: { async check(): Promise<ClinicalWarning[]> {
        return [
          { category: 'allergy', severity: 'low',      code: 'A', message: 'a', source: 'stub-test' },
          { category: 'allergy', severity: 'critical', code: 'B', message: 'b', source: 'stub-test' },
          { category: 'allergy', severity: 'moderate', code: 'C', message: 'c', source: 'stub-test' },
        ]
      } },
      interaction: { async check() { return [] } },
      dose: { async check() { return [] } },
      contraindication: { async check() { return [] } },
      pregnancy: { async check() { return [] } },
      renal: { async check() { return [] } },
      hepatic: { async check() { return [] } },
    }
    registerProvider(stub)
    const r = await runClinicalCheck({
      patient: { patientId: 'p1', knownAllergies: [], activeConditions: [] },
      drugs: [],
    }, 'stub-test')
    expect(r.warnings.map((w) => w.severity)).toEqual(['critical', 'moderate', 'low'])
  })
})
