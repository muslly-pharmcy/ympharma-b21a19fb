// Structured error logger with pluggable hooks.
// - Always logs to console (structured shape).
// - Fires registered hooks (e.g., ship to /api/errors/report, Lovable telemetry).
// - Never throws — logging must not crash the app.

import type { ClassifiedError } from './classify'

export interface ErrorReport {
  correlationId: string
  kind: ClassifiedError['kind']
  status?: number
  message: string
  boundary: string
  route?: string
  userAgent?: string
  timestamp: string
  stack?: string
  extra?: Record<string, unknown>
}

type Hook = (report: ErrorReport) => void | Promise<void>

const hooks: Hook[] = []

export function registerErrorHook(hook: Hook): () => void {
  hooks.push(hook)
  return () => {
    const i = hooks.indexOf(hook)
    if (i >= 0) hooks.splice(i, 1)
  }
}

export function reportError(input: {
  correlationId: string
  classified: ClassifiedError
  boundary: string
  extra?: Record<string, unknown>
}): void {
  const stack = input.classified.original instanceof Error ? input.classified.original.stack : undefined
  const route = typeof window !== 'undefined' ? window.location?.pathname : undefined
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : undefined

  const report: ErrorReport = {
    correlationId: input.correlationId,
    kind: input.classified.kind,
    status: input.classified.status,
    message: input.classified.message,
    boundary: input.boundary,
    route,
    userAgent,
    timestamp: new Date().toISOString(),
    stack,
    extra: input.extra,
  }

  // Structured console output — searchable in devtools + server logs.
  try {
    console.error('[error]', report)
  } catch {
    /* noop */
  }

  for (const hook of hooks) {
    try {
      const result = hook(report)
      if (result && typeof (result as Promise<unknown>).catch === 'function') {
        ;(result as Promise<unknown>).catch(() => {
          /* swallow — logging must never crash */
        })
      }
    } catch {
      /* swallow */
    }
  }
}
