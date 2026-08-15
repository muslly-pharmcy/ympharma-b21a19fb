/**
 * Google Custom Search (image) helpers for catalog product imagery.
 * Server-only: multi-key rotation, exponential backoff, resolution ranking.
 */
import { retryAsync, isRetryableStatus } from '@/lib/net/retry'

const IMG_EXT = /\.(jpe?g|png|webp)(\?|$)/i

/** Reputable pharma / medical directory hosts get a ranking bonus. */
const PREFERRED_HOSTS = [
  'dawaback', 'altibbi', 'vidal', 'webteb', 'drugs.com', 'medicines',
  'pharmacy', 'pharma', 'sehatok', 'edrugstore', 'nahdionline', 'aldawaa',
  'unitedpharmacies', 'chemist', 'boots', 'wellcare', 'sidalih', 'tebcan',
]

export interface CseItem {
  link?: string
  mime?: string
  image?: { width?: number; height?: number; contextLink?: string }
}

export function scoreItem(item: CseItem): number {
  const link = item.link ?? ''
  if (!IMG_EXT.test(link)) return -1
  if (!/^https:\/\//i.test(link)) return -1
  const w = item.image?.width ?? 0
  const h = item.image?.height ?? 0
  if (w && h && (w < 200 || h < 200)) return -1
  let score = (w || 300) * (h || 300)
  const host = (() => {
    try {
      return new URL(link).hostname.toLowerCase()
    } catch {
      return ''
    }
  })()
  if (PREFERRED_HOSTS.some((p) => host.includes(p))) score *= 1.6
  return score
}

/** Parse one or many keys out of a comma separated string or JSON array. */
export function parseKeyList(raw: string | undefined): string[] {
  if (!raw) return []
  const trimmed = raw.trim()
  let parts: string[]
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed) as unknown
      parts = Array.isArray(arr) ? arr.map((v) => String(v)) : []
    } catch {
      parts = trimmed.split(',')
    }
  } else {
    parts = trimmed.split(',')
  }
  return [...new Set(parts.map((p) => p.trim()).filter(Boolean))]
}

export function collectApiKeys(env: Record<string, string | undefined>): string[] {
  return [...new Set([...parseKeyList(env['GOOGLE_API_KEYS']), ...parseKeyList(env['GOOGLE_API_KEY'])])]
}

export function collectSearchEngineIds(env: Record<string, string | undefined>): string[] {
  return [
    ...new Set([
      ...parseKeyList(env['GOOGLE_SEARCH_ENGINE_ID']),
      ...parseKeyList(env['GOOGLE_CSE_ID']),
      ...parseKeyList(env['GOOGLE_CX_ID']),
    ]),
  ]
}

export const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })

export type SkipReason = 'quota' | 'no_image' | 'stopped' | 'error'

export interface SearchOutcome {
  url: string | null
  /** set when the current key must be retired */
  keyFailure?: 'quota' | 'invalid'
  error?: string
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function classifyGoogleFailure(status: number, body: string): 'quota' | 'invalid' | null {
  if (status === 429) return 'quota'
  if (status === 403) {
    return /quotaExceeded|rateLimitExceeded|dailyLimitExceeded|userRateLimit/i.test(body)
      ? 'quota'
      : 'invalid'
  }
  if (status === 400 || status === 401) return 'invalid'
  return null
}

/** One image search against a single key. Retries transient failures. */
export async function searchImage(
  query: string,
  key: string,
  cx: string,
  signal?: AbortSignal,
): Promise<SearchOutcome> {
  const params = new URLSearchParams({
    key,
    cx,
    q: query,
    searchType: 'image',
    imgType: 'photo',
    imgSize: 'large',
    safe: 'active',
    num: '5',
  })

  try {
    const json = await retryAsync<{ items?: CseItem[] }>(
      async () => {
        const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params.toString()}`, {
          signal,
        })
        if (!res.ok) {
          const detail = await res.text()
          throw new HttpError(res.status, detail.slice(0, 300))
        }
        return (await res.json()) as { items?: CseItem[] }
      },
      {
        retries: 3,
        baseDelayMs: 500,
        maxDelayMs: 8000,
        signal,
        // 429 is retried by retryAsync; if it still fails we rotate the key below.
      },
    )

    const ranked = (json.items ?? [])
      .map((item) => ({ item, score: scoreItem(item) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
    return { url: ranked[0]?.item.link ?? null }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e
    if (e instanceof HttpError) {
      const failure = classifyGoogleFailure(e.status, e.message)
      if (failure === 'quota') {
        return { url: null, keyFailure: 'quota', error: 'تجاوز حصة مفتاح جوجل' }
      }
      if (failure === 'invalid') {
        return {
          url: null,
          keyFailure: 'invalid',
          error: 'مفتاح جوجل غير صالح أو Custom Search API غير مُفعّل',
        }
      }
      if (isRetryableStatus(e.status)) {
        return { url: null, error: `google_${e.status}` }
      }
      return { url: null, error: `google_${e.status}: ${e.message.slice(0, 160)}` }
    }
    return { url: null, error: (e as Error).message }
  }
}

/** Rotates through keys when one is exhausted or rejected. */
export class KeyRotator {
  private index = 0
  private used = new Set<string>()

  constructor(
    private keys: string[],
    private cx: string,
  ) {}

  get exhausted() {
    return this.index >= this.keys.length
  }

  get keysUsed() {
    return this.used.size
  }

  get lastError() {
    return this.error
  }

  private error: string | undefined

  async search(query: string, signal?: AbortSignal): Promise<SearchOutcome> {
    while (!this.exhausted) {
      const key = this.keys[this.index]!
      this.used.add(key)
      const outcome = await searchImage(query, key, this.cx, signal)
      if (outcome.keyFailure) {
        this.error = outcome.error
        this.index += 1
        continue
      }
      return outcome
    }
    return { url: null, keyFailure: 'quota', error: this.error ?? 'نفدت جميع مفاتيح جوجل' }
  }
}
