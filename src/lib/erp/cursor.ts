export type StockCursor = { item: string; branch: string }
export type OrderCursor = { at: string; id: string }
const id = /^[A-Za-z0-9_-]{1,120}$/
export function encodeCursor(value: StockCursor | OrderCursor) { return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url') }
export function decodeCursor<T extends StockCursor | OrderCursor>(raw: string | null, kind: 'stock' | 'orders'): T | null {
  if (!raw) return null
  if (raw.length > 600 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw Error('invalid_cursor')
  const value = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
  if (encodeCursor(value) !== raw) throw Error('noncanonical_cursor')
  if (kind === 'stock' ? Object.keys(value).sort().join(',') !== 'branch,item' || typeof value.item !== 'string' || typeof value.branch !== 'string' || !id.test(value.item) || !id.test(value.branch) : Object.keys(value).sort().join(',') !== 'at,id' || typeof value.at !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.at) || !Number.isFinite(Date.parse(value.at)) || !/^[a-f0-9-]{36}$/.test(value.id)) throw Error('invalid_cursor')
  return value as T
}
/** Reference ordering for future immutable outbox pages. Orders routes remain closed. */
export const orderAfter = (value: OrderCursor, cursor: OrderCursor) => value.at > cursor.at || value.at === cursor.at && value.id > cursor.id
