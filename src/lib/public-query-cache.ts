// Product responses may contain signed URLs that expire after 15 minutes.
// Keep those in memory and refresh while visible; persist stable metadata only.
export const PRODUCT_IMAGE_REFRESH_MS = 10 * 60_000
const PERSISTED_STOREFRONT_READS = new Set(['categories', 'shipping-zones', 'payment-methods'])

export function shouldPersistPublicQuery(query: {
  queryKey: readonly unknown[]
  state: { status: string }
}): boolean {
  return query.state.status === 'success' && query.queryKey[0] === 'storefront'
    && PERSISTED_STOREFRONT_READS.has(String(query.queryKey[1]))
}
