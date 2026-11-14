import { describe, expect, it, vi } from 'vitest'
import { requireOrganizationRecord } from '@/lib/organization-record.server'

type LookupResult = {
  data: { id: string } | null
  error: { message: string } | null
}

function makeDatabase(result: LookupResult) {
  const filters: Array<[string, string]> = []
  const query = {
    eq: vi.fn((column: string, value: string) => {
      filters.push([column, value])
      return query
    }),
    maybeSingle: vi.fn(async () => result),
  }
  const select = vi.fn(() => query)
  const from = vi.fn(() => ({ select }))
  return { db: { from }, filters, from, select, query }
}

describe('requireOrganizationRecord', () => {
  it('requires both the record id and its organization id', async () => {
    const mock = makeDatabase({ data: { id: 'record-a' }, error: null })

    await expect(
      requireOrganizationRecord(mock.db, 'insv2_providers', 'record-a', 'org-a'),
    ).resolves.toBeUndefined()

    expect(mock.from).toHaveBeenCalledWith('insv2_providers')
    expect(mock.select).toHaveBeenCalledWith('id')
    expect(mock.filters).toEqual([
      ['id', 'record-a'],
      ['organization_id', 'org-a'],
    ])
  })

  it('fails closed when the row is missing from the requested organization', async () => {
    const mock = makeDatabase({ data: null, error: null })

    await expect(
      requireOrganizationRecord(mock.db, 'insv2_plans', 'record-b', 'org-a'),
    ).rejects.toThrow('Forbidden: record is not in organization')
  })

  it('propagates database lookup errors rather than continuing the write', async () => {
    const mock = makeDatabase({ data: null, error: { message: 'database unavailable' } })

    await expect(
      requireOrganizationRecord(mock.db, 'hc_patients', 'patient-c', 'org-a'),
    ).rejects.toThrow('database unavailable')
  })
})
