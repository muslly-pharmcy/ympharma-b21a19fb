type OrganizationRecord = { id: string }
type QueryResult = { data: OrganizationRecord | null; error: { message: string } | null }
type OrganizationQuery = {
  eq(column: string, value: string): OrganizationQuery
  maybeSingle(): Promise<QueryResult>
}
type OrganizationDatabase = {
  from(table: string): { select(columns: string): OrganizationQuery }
}

/** Fail closed when a service-role operation references a record outside its tenant. */
export async function requireOrganizationRecord(
  db: OrganizationDatabase,
  table: string,
  id: string,
  organizationId: string,
): Promise<void> {
  const { data, error } = await db.from(table).select('id')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Forbidden: record is not in organization')
}
