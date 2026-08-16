// Sentry frontend init. No-op unless VITE_SENTRY_DSN is set at build time,
// so dropping the env var later cleanly disables reporting without code changes.
// Environment separation is derived from VITE_APP_ENV (development/staging/production).
import * as Sentry from '@sentry/react'

let initialized = false

export function initSentry(): void {
  if (initialized) return
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  if (!dsn) return
  const env =
    (import.meta.env.VITE_APP_ENV as string | undefined) ??
    (import.meta.env.PROD ? 'production' : 'development')
  const release = (import.meta.env.VITE_APP_RELEASE as string | undefined) ?? undefined

  Sentry.init({
    dsn,
    environment: env,
    release,
    // Conservative sampling — production performance not free.
    tracesSampleRate: env === 'production' ? 0.05 : 0.2,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: env === 'production' ? 0.05 : 0,
    sendDefaultPii: false,
    beforeSend(event) {
      // Strip common PII surfaces that Sentry might auto-attach.
      if (event.user) {
        delete event.user.email
        delete event.user.ip_address
        delete event.user.username
      }
      if (event.request?.cookies) delete event.request.cookies
      if (event.request?.headers) {
        for (const h of ['authorization', 'cookie', 'set-cookie', 'apikey', 'x-api-key']) {
          delete (event.request.headers as Record<string, unknown>)[h]
        }
      }
      return event
    },
    ignoreErrors: [
      // Noisy browser extension errors.
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications.',
      'Non-Error promise rejection captured',
    ],
  })
  initialized = true
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return
  Sentry.captureException(err, { extra: context })
}
