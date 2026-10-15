import { updateProductInput, type UpdateProductInput } from '@/domain/catalog/commands'
import type { Actor } from './session.server'

export interface CatalogUpdateDatabase {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{
    data: unknown
    error: { message: string } | null
  }>
}

/** Server-only transaction boundary. The caller must resolve its authenticated actor.
 * The RPC independently checks active organization membership and catalog permission.
 * No fallback to separate update/event/audit writes: unconfirmed means retry the same key.
 */
export async function updateCatalogProduct(
  db: CatalogUpdateDatabase,
  actor: Actor,
  raw: UpdateProductInput,
): Promise<{ id: string; correlationId: string; revision: string }> {
  const data = updateProductInput.parse(raw)
  const patch = Object.fromEntries(Object.entries(data.patch).filter(([, value]) => value !== undefined))
  if (!Object.keys(patch).length) throw new Error('EMPTY_PRODUCT_PATCH')
  const { data: result, error } = await db.rpc('catalog_update_product_atomic', {
    p_actor: actor.userId,
    p_org: actor.organizationId,
    p_product: data.id,
    p_key: data.idempotencyKey ?? crypto.randomUUID(),
    p_patch: patch,
    p_expected_revision: data.expectedRevision ?? null,
    p_correlation: data.correlationId ?? actor.correlationId,
  })
  if (error) throw new Error(error.message)
  const value = result as { id?: unknown; correlationId?: unknown; revision?: unknown } | null
  if (!value || value.id !== data.id || typeof value.correlationId !== 'string' ||
      typeof value.revision !== 'string' || !/^[1-9][0-9]*$/.test(value.revision)) {
    throw new Error('PRODUCT_UPDATE_UNCONFIRMED')
  }
  return value as { id: string; correlationId: string; revision: string }
}
