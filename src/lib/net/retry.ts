/**
 * Exponential backoff with jitter for transient network failures.
 * Only retries what is genuinely retryable: network errors, 429 and 5xx.
 */

export interface RetryOptions {
  retries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void
  signal?: AbortSignal
}

const DEFAULTS = { retries: 3, baseDelayMs: 400, maxDelayMs: 6000 }

/** Status codes worth retrying. */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return false
  const status = (error as { status?: number } | null)?.status
  if (typeof status === 'number') return isRetryableStatus(status)

  const message = error instanceof Error ? error.message : String(error ?? '')
  if (/HTTP error! status: (408|425|429|5\d{2})/i.test(message)) return true
  return /network|fetch failed|failed to fetch|timeout|timed out|ECONNRESET|ENOTFOUND|socket hang up|load failed/i.test(
    message,
  )
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

/** Run `fn`, retrying transient failures with exponential backoff + jitter. */
export async function retryAsync<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { retries, baseDelayMs, maxDelayMs } = { ...DEFAULTS, ...options }
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt === retries || !isRetryableError(error)) break

      const exponential = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs)
      const wait = Math.round(exponential / 2 + Math.random() * (exponential / 2))
      options.onRetry?.(attempt + 1, error, wait)
      await delay(wait, options.signal)
    }
  }

  throw lastError
}
