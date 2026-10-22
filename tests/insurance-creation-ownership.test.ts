import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = { id: string; organization_id?: string | null; dispense_id?: string; is_public?: boolean; status?: string }
const state = vi.hoisted(() => ({
  rows: {} as Record<string, Row[]>,
  writes: [] as Array<{ table: string; operation: string; filters: Array<[string, unknown]> }>,
  lookups: [] as Array<{ table: string; columns: string; filters: Array<[string, unknown]> }>,
  actor: { userId: '', organizationId: '', branchId: null as string | null },
  errorTable: '',
  permissionDenied: false,
  audit: vi.fn(),
  rpc: vi.fn(async () => ({ data: {id:'created-record',correlationId:'test-correlation'}, error: null })),
}))

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    validator: (parse: (raw: unknown) => unknown) => ({
      handler: (fn: (input: { data: unknown }) => Promise<unknown>) =>
        (input: { data: unknown }) => fn({ data: parse(input.data) }),
    }),
  }),
}))
vi.mock('@/lib/session.server', () => ({
  getActor: async () => state.actor,
  requireOrg: (actor: typeof state.actor, org: string) => {
    if (actor.organizationId !== org) throw new Error('organization denied')
  },
  requirePermission: () => {
    if (state.permissionDenied) throw new Error('permission denied')
  },
}))
vi.mock('@/lib/idempotency.server', () => ({
  newCorrelationId: () => 'test-correlation',
  withIdempotency: (_key: unknown, _actor: unknown, _action: unknown, fn: () => Promise<unknown>) => fn(),
}))
vi.mock('@/lib/audit.server', () => ({ audit: state.audit }))
vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: {
    rpc: state.rpc,
    from: (table: string) => {
      const filters: Array<[string, unknown]> = []
      let operation = 'read'
      let columns = ''
      const result = () => {
        if (state.errorTable === table) return { data: null, error: { message: 'lookup unavailable' } }
        if (operation !== 'read') return { data: [{ id: 'created-record' }], error: null }
        state.lookups.push({ table, columns, filters: [...filters] })
        const data = (state.rows[table] ?? []).filter((row) => filters.every(([column, value]) => {
          if (column === 'dispense.organization_id') {
            return state.rows.hc_dispenses.some((dispense) => dispense.id === row.dispense_id && dispense.organization_id === value)
          }
          const actual = row[column as keyof Row]
          return Array.isArray(value) ? value.includes(actual) : actual === value
        }))
        return { data, error: null }
      }
      const query = {
        select: (value: string) => { columns = value; return query },
        eq: (column: string, value: unknown) => { filters.push([column, value]); return query },
        in: (column: string, value: string[]) => { filters.push([column, value]); return query },
        insert: (_payload: unknown) => { operation = 'insert'; state.writes.push({ table, operation, filters }); return query },
        update: (_payload: unknown) => { operation = 'update'; state.writes.push({ table, operation, filters }); return query },
        maybeSingle: async () => { const res = result(); return { ...res, data: res.data?.[0] ?? null } },
        single: async () => { const res = result(); return { ...res, data: res.data?.[0] ?? null } },
        then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
      }
      return query
    },
  },
}))

import { createAuthorization, createInsuranceClaim, upsertInsuranceProvider, upsertInsurancePlan, upsertPatientInsurance } from '@/lib/insurance.mutations.functions'

// Keep the reference utility's regression coverage separate from the atomic
// handler: the RPC now owns authoritative reference checks and replay order.
import { requireClaimReferences } from '@/lib/insurance-references.server'
import { createClaimInput } from '@/domain/insurance/commands'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
const checkClaimReferences = async ({data}: {data: unknown}) => {
  await requireClaimReferences(supabaseAdmin as unknown as Parameters<typeof requireClaimReferences>[0], createClaimInput.parse(data), state.actor.branchId)
  return {id:'created-record'}
}
const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`
const orgA = id(1), orgB = id(2), missing = id(999)
const pairs: Array<[string, number]> = [
  ['branches', 10], ['hc_patients', 20], ['insv2_providers', 30], ['insv2_plans', 40],
  ['hc_prescriptions', 50], ['hc_dispenses', 60], ['insv2_authorizations', 70],
  ['catalog_products', 80], ['insv2_patient_insurance', 110],
]
const authorization = () => ({ organizationId: orgA, patientId: id(20), planId: id(40), prescriptionId: id(50) })
const claim = () => ({
  idempotencyKey: 'ownership-claim-key',
  organizationId: orgA, patientId: id(20), providerId: id(30), planId: id(40),
  dispenseId: id(60), prescriptionId: id(50), authorizationId: id(70),
  items: [{ productId: id(80), dispenseItemId: id(90), description: 'synthetic item', billedAmount: 10 }],
})
const invoke = (fn: unknown, data: unknown) => (fn as (input: { data: unknown }) => Promise<unknown>)({ data })

beforeEach(() => {
  state.rows = Object.fromEntries(pairs.map(([table, value]) => [table, [
    { id: id(value), organization_id: orgA, is_public: false, status: 'draft' },
    { id: id(value + 1), organization_id: orgB, is_public: false, status: 'draft' },
  ]]))
  state.rows.hc_dispense_items = [{ id: id(90), dispense_id: id(60) }, { id: id(91), dispense_id: id(61) }]
  state.rows.catalog_products.push(
    { id: id(82), organization_id: null, is_public: true, status: 'approved' },
    { id: id(83), organization_id: orgB, is_public: true, status: 'approved' },
    { id: id(84), organization_id: null, is_public: true, status: 'draft' },
    { id: id(85), organization_id: null, is_public: false, status: 'approved' },
  )
  state.actor = { userId: id(3), organizationId: orgA, branchId: id(10) }
  state.errorTable = ''
  state.permissionDenied = false
  state.writes = []
  state.lookups = []
  state.audit.mockClear()
  state.rpc.mockClear()
})

async function expectRejectedWithoutWrite(fn: unknown, input: unknown, error = 'Forbidden') {
  await expect(invoke(fn, input)).rejects.toThrow(error)
  expect(state.writes).toEqual([])
  expect(state.audit).not.toHaveBeenCalled()
  expect(state.rpc).not.toHaveBeenCalled()
}

describe('authorization reference ownership at the handler boundary', () => {
  for (const [field, foreign] of [['patientId', 21], ['planId', 41], ['prescriptionId', 51]] as const) {
    it.each([['foreign', id(foreign)], ['missing', missing]])(`rejects ${field} %s before insert`, async (_kind, value) => {
      await expectRejectedWithoutWrite(createAuthorization, { ...authorization(), [field]: value })
    })
  }
  it.each([id(50), null, undefined])('allows same-org references with prescription %s', async (prescriptionId) => {
    await expect(invoke(createAuthorization, { ...authorization(), prescriptionId })).resolves.toMatchObject({ id: 'created-record' })
    expect(state.writes.map((write) => write.table)).toEqual(['insv2_authorizations'])
  })
})

describe('claim reference preflight utility (database RPC is authoritative)', () => {
  for (const [field, foreign] of [
    ['patientId', 21], ['providerId', 31], ['planId', 41], ['dispenseId', 61],
    ['prescriptionId', 51], ['authorizationId', 71],
  ] as const) {
    it.each([['foreign', id(foreign)], ['missing', missing]])(`rejects ${field} %s before any claim write`, async (_kind, value) => {
      await expectRejectedWithoutWrite(checkClaimReferences, { ...claim(), [field]: value })
    })
  }
  for (const [field, foreign] of [['productId', 81], ['dispenseItemId', 91]] as const) {
    it.each([['foreign', id(foreign)], ['missing', missing]])(`rejects item ${field} %s before any claim write`, async (_kind, value) => {
      const data = claim()
      data.items.push({ ...data.items[0], [field]: value })
      await expectRejectedWithoutWrite(checkClaimReferences, data)
    })
  }
  it.each([id(11), missing])('rejects foreign or missing actor branch %s', async (branchId) => {
    state.actor.branchId = branchId
    await expectRejectedWithoutWrite(checkClaimReferences, claim())
  })
  it('accepts all same-org references and derives item ownership through its dispense', async () => {
    await expect(invoke(checkClaimReferences, claim())).resolves.toMatchObject({ id: 'created-record' })
    expect(state.writes).toEqual([])
    expect(state.rpc).not.toHaveBeenCalled()
    expect(state.lookups).toContainEqual({
      table: 'hc_dispense_items', columns: 'id, dispense:hc_dispenses!inner(id)',
      filters: [['id', [id(90)]], ['dispense.organization_id', orgA]],
    })
  })
  it('accepts omitted optional references and a null branch', async () => {
    state.actor.branchId = null
    await expect(invoke(checkClaimReferences, {
      organizationId: orgA, patientId: id(20), providerId: id(30), planId: id(40), idempotencyKey:'manual-claim-key',
      items: [{ description: 'manual claim item' }],
    })).resolves.toMatchObject({ id: 'created-record' })
    expect(state.lookups.map((lookup) => lookup.table)).toEqual(['hc_patients', 'insv2_providers', 'insv2_plans'])
  })
  it.each([82, 83])('preserves approved public catalog product %s', async (product) => {
    const data = claim(); data.items[0].productId = id(product)
    await expect(invoke(checkClaimReferences, data)).resolves.toMatchObject({ id: 'created-record' })
  })
  it.each([84, 85])('denies global products that are unpublished or unapproved: %s', async (product) => {
    const data = claim(); data.items[0].productId = id(product)
    await expectRejectedWithoutWrite(checkClaimReferences, data)
  })
  it('deduplicates repeated item references for the ownership lookup', async () => {
    const data = claim(); data.items.push({ ...data.items[0] })
    await invoke(checkClaimReferences, data)
    for (const table of ['catalog_products', 'hc_dispense_items']) {
      const checks = state.lookups.filter((lookup) => lookup.table === table)
      expect(checks).toHaveLength(1)
      expect(checks[0].filters[0][1]).toHaveLength(1)
    }
  })
  it.each(['hc_patients', 'catalog_products', 'hc_dispense_items'])('fails closed on %s lookup errors', async (table) => {
    state.errorTable = table
    await expectRejectedWithoutWrite(checkClaimReferences, claim(), 'lookup unavailable')
  })
  it('rejects an organization mismatch before looking up records', async () => {
    await expectRejectedWithoutWrite(createInsuranceClaim, { ...claim(), organizationId: orgB }, 'organization denied')
    expect(state.lookups).toEqual([])
  })
  it('rejects missing permission before looking up records', async () => {
    state.permissionDenied = true
    await expectRejectedWithoutWrite(createInsuranceClaim, claim(), 'permission denied')
    expect(state.lookups).toEqual([])
  })
})

describe('preserved PR15 upserts', () => {
  const cases = [
    [upsertInsuranceProvider, 'insv2_providers', 30, { organizationId: orgA, code: 'provider', name: 'Provider' }],
    [upsertInsurancePlan, 'insv2_plans', 40, { organizationId: orgA, providerId: id(30), code: 'plan', name: 'Plan' }],
    [upsertPatientInsurance, 'insv2_patient_insurance', 110, { organizationId: orgA, patientId: id(20), planId: id(40), policyNumber: 'synthetic' }],
  ] as const
  for (const [fn, table, record, input] of cases) {
    it(`rejects a foreign ${table} update target`, async () => {
      await expectRejectedWithoutWrite(fn, { ...input, id: id(record + 1) })
    })
    it(`allows a same-org ${table} update and scopes the write`, async () => {
      await expect(invoke(fn, { ...input, id: id(record) })).resolves.toMatchObject({ id: 'created-record' })
      expect(state.writes[0].filters).toEqual([['id', id(record)], ['organization_id', orgA]])
    })
  }
  it('rejects a foreign provider on a new plan', async () => {
    await expectRejectedWithoutWrite(upsertInsurancePlan, { ...cases[1][3], providerId: id(31) })
  })
  it.each([['patientId', id(21)], ['planId', id(41)]])('rejects a foreign %s on patient insurance', async (field, value) => {
    await expectRejectedWithoutWrite(upsertPatientInsurance, { ...cases[2][3], [field]: value })
  })
})
