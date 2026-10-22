import type { CreateAuthorizationInput, CreateClaimInput } from '@/domain/insurance/commands'
import { requireOrganizationRecord } from './organization-record.server'

type ReferenceRow = { id: string; organization_id?: string | null; is_public?: boolean; status?: string }
type LookupResult = { data: ReferenceRow[] | null; error: { message: string } | null }
type ReferenceQuery = PromiseLike<LookupResult> & {
  eq(column: string, value: string): ReferenceQuery
  in(column: string, values: string[]): ReferenceQuery
  maybeSingle(): Promise<{ data: { id: string } | null; error: { message: string } | null }>
}
type ReferenceDatabase = { from(table: string): { select(columns: string): ReferenceQuery } }

async function requireItemReferences(
  db: ReferenceDatabase,
  table: 'catalog_products' | 'hc_dispense_items',
  ids: string[],
  organizationId: string,
) {
  const uniqueIds = [...new Set(ids)]
  if (!uniqueIds.length) return
  // Dispense items have no organization_id: their dispense is the ownership root.
  const indirect = table === 'hc_dispense_items'
  let query = db.from(table)
    .select(indirect ? 'id, dispense:hc_dispenses!inner(id)' : 'id, organization_id, is_public, status')
    .in('id', uniqueIds)
  if (indirect) query = query.eq('dispense.organization_id', organizationId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  const found = new Set((data ?? []).map((row) => row.id))
  // Preserve the catalog's explicit public-read contract for approved products,
  // regardless of owning organization; other products must belong to this org.
  const foreignProduct = !indirect && (data ?? []).some((row) =>
    row.organization_id !== organizationId &&
    !(row.is_public === true && row.status === 'approved'),
  )
  if (foreignProduct || uniqueIds.some((id) => !found.has(id))) {
    throw new Error('Forbidden: record is not in organization')
  }
}

export async function requireAuthorizationReferences(db: ReferenceDatabase, data: CreateAuthorizationInput) {
  await requireOrganizationRecord(db, 'hc_patients', data.patientId, data.organizationId)
  await requireOrganizationRecord(db, 'insv2_plans', data.planId, data.organizationId)
  if (data.prescriptionId) {
    await requireOrganizationRecord(db, 'hc_prescriptions', data.prescriptionId, data.organizationId)
  }
}

export async function requireClaimReferences(
  db: ReferenceDatabase,
  data: CreateClaimInput,
  branchId: string | null,
) {
  await requireOrganizationRecord(db, 'hc_patients', data.patientId, data.organizationId)
  await requireOrganizationRecord(db, 'insv2_providers', data.providerId, data.organizationId)
  await requireOrganizationRecord(db, 'insv2_plans', data.planId, data.organizationId)
  for (const [table, id] of [
    ['branches', branchId],
    ['hc_dispenses', data.dispenseId],
    ['hc_prescriptions', data.prescriptionId],
    ['insv2_authorizations', data.authorizationId],
  ] as const) {
    if (id) await requireOrganizationRecord(db, table, id, data.organizationId)
  }
  await requireItemReferences(db, 'catalog_products', data.items.flatMap((item) => item.productId ? [item.productId] : []), data.organizationId)
  await requireItemReferences(db, 'hc_dispense_items', data.items.flatMap((item) => item.dispenseItemId ? [item.dispenseItemId] : []), data.organizationId)
}
