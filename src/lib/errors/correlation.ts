// Correlation IDs — short, URL-safe, sortable-ish (time prefix + random).
// SSR-safe: uses crypto.randomUUID when available, otherwise Math.random fallback.

function randomSegment(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => Uint8Array } }
  if (g.crypto?.randomUUID) return g.crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  if (g.crypto?.getRandomValues) {
    const arr = new Uint8Array(6)
    g.crypto.getRandomValues(arr)
    return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
  }
  return Math.random().toString(16).slice(2, 14).padEnd(12, '0')
}

export function newCorrelationId(prefix = 'err'): string {
  const t = Date.now().toString(36)
  return `${prefix}_${t}_${randomSegment()}`
}
