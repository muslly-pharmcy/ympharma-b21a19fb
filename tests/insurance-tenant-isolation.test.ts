import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('insurance tenant isolation', () => {
  const source = readFileSync(resolve('src/lib/insurance.mutations.functions.ts'), 'utf8')

  it('scopes every insurance upsert update by record id and organization id', () => {
    const updateQueries = source.match(
      /db\.from\('insv2_(?:providers|plans|patient_insurance)'\)\.update\(payload\)[^\n]*/g,
    ) ?? []

    expect(updateQueries).toHaveLength(3)
    for (const query of updateQueries) {
      expect(query).toContain(".eq('id', data.id)")
      expect(query).toContain(".eq('organization_id', data.organizationId)")
    }
  })

  it('validates provider, patient, plan, and existing linkage ownership before writes', () => {
    expect(source).toContain(
      "requireOrganizationRecord(db, 'insv2_providers', data.providerId, data.organizationId)",
    )
    expect(source).toContain(
      "requireOrganizationRecord(db, 'hc_patients', data.patientId, data.organizationId)",
    )
    expect(source).toContain(
      "requireOrganizationRecord(db, 'insv2_plans', data.planId, data.organizationId)",
    )
    expect(source).toContain(
      "requireOrganizationRecord(db, 'insv2_patient_insurance', data.id, data.organizationId)",
    )
  })
})
