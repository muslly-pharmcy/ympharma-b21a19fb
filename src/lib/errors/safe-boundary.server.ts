/**
 * Safe error boundary for server functions.
 *
 * Logs the full (redacted) detail server-side and returns a generic Arabic
 * message plus a correlation id to the client, so no patient data, SQL text,
 * table name or stack frame ever crosses the RPC boundary.
 */
import { createLogger, redactForLog } from '@/lib/observability/logger.server'

const log = createLogger({ service: 'server-fn', component: 'safe-boundary' })

const GENERIC_MESSAGE = 'تعذّر إتمام العملية. تمت مراجعة الخطأ داخلياً، يرجى المحاولة مجدداً.'

/** Errors intentionally shown to the user (validation, business rules). */
export class SafeError extends Error {
  readonly safe = true
  constructor(message: string) {
    super(message)
    this.name = 'SafeError'
  }
}

export function isSafeError(err: unknown): err is SafeError {
  return err instanceof SafeError || (typeof err === 'object' && err !== null && (err as { safe?: boolean }).safe === true)
}

export interface SafeBoundaryError extends Error {
  errorId: string
}

function newErrorId(): string {
  return `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Wrap a critical server operation. Re-throws a sanitized error.
 *
 * ```ts
 * .handler(({ data }) => withSafeBoundary('dispense.complete', () => run(data)))
 * ```
 */
export async function withSafeBoundary<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>,
): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (isSafeError(err)) throw err

    const errorId = newErrorId()
    const raw = err instanceof Error ? err : new Error(String(err))
    log.error('server operation failed', {
      operation,
      errorId,
      error: raw.message,
      stack: raw.stack?.split('\n').slice(0, 4).join(' | '),
      ...(context ? (redactForLog(context) as Record<string, unknown>) : {}),
    })

    const safe = new Error(`${GENERIC_MESSAGE} (رمز الخطأ: ${errorId})`) as SafeBoundaryError
    safe.errorId = errorId
    throw safe
  }
}

/** Non-throwing variant: returns a discriminated result instead. */
export async function safeResult<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await withSafeBoundary(operation, fn, context) }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}
