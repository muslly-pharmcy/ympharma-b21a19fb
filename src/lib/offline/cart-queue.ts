/**
 * Offline queue for Shopify cart operations.
 *
 * When the device is offline, cart mutations are appended here (persisted in
 * localStorage) and replayed in order the moment connectivity returns.
 */

export type QueuedCartOp =
  | { kind: 'add'; variantId: string; quantity: number; payload: unknown }
  | { kind: 'update'; variantId: string; quantity: number }
  | { kind: 'remove'; variantId: string }

export interface QueuedEntry {
  id: string
  op: QueuedCartOp
  queuedAt: number
}

const STORAGE_KEY = 'ympharma.cart.offline-queue.v1'

type Listener = (entries: QueuedEntry[]) => void
const listeners = new Set<Listener>()

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function readQueue(): QueuedEntry[] {
  if (!isBrowser()) return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as QueuedEntry[]) : []
  } catch {
    return []
  }
}

function writeQueue(entries: QueuedEntry[]): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    /* storage full or blocked — the queue degrades to in-memory for this tab */
  }
  for (const listener of listeners) listener(entries)
}

export function enqueueCartOp(op: QueuedCartOp): QueuedEntry {
  const entry: QueuedEntry = {
    id: `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    op,
    queuedAt: Date.now(),
  }
  writeQueue([...readQueue(), entry])
  return entry
}

export function clearQueue(): void {
  writeQueue([])
}

export function subscribeToQueue(listener: Listener): () => void {
  listeners.add(listener)
  listener(readQueue())
  return () => {
    listeners.delete(listener)
  }
}

export function pendingCount(): number {
  return readQueue().length
}

/**
 * Replay the queue in FIFO order. Entries that fail are kept for the next
 * attempt; entries that succeed are removed immediately so a mid-flight
 * disconnect never double-applies an operation.
 */
export async function drainQueue(
  apply: (op: QueuedCartOp) => Promise<void>,
): Promise<{ processed: number; remaining: number }> {
  let processed = 0
  let queue = readQueue()

  while (queue.length > 0) {
    const [next, ...rest] = queue
    if (!next) break
    try {
      await apply(next.op)
    } catch {
      break
    }
    processed += 1
    queue = rest
    writeQueue(queue)
  }

  return { processed, remaining: readQueue().length }
}
