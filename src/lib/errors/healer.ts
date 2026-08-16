// Auto-healer: reacts to classified errors and applies remediation.
// - network: on 'online' event, invalidate stale queries to auto-recover.
// - chunk: prompt a soft reload (stale bundle after deploy).
// - auth: broadcast so UI can route to /auth (no forced redirect here).
// - server / rate_limit: schedule a single retry via query invalidation.
//
// Safe to install once at app boot. All side effects gated by browser env.

import type { QueryClient } from '@tanstack/react-query'
import type { ClassifiedError } from './classify'
import { registerErrorHook, type ErrorReport } from './logger'

interface HealerOptions {
  queryClient: QueryClient
  onAuthLost?: () => void
  onChunkStale?: () => void
}

let installed = false

export function installErrorHealer(opts: HealerOptions): void {
  if (typeof window === 'undefined' || installed) return
  installed = true

  const { queryClient, onAuthLost, onChunkStale } = opts

  const pendingRetryKinds = new Set<ClassifiedError['kind']>()
  let retryTimer: ReturnType<typeof setTimeout> | null = null

  const scheduleInvalidate = (delay: number) => {
    if (retryTimer) return
    retryTimer = setTimeout(() => {
      retryTimer = null
      pendingRetryKinds.clear()
      try {
        void queryClient.invalidateQueries({ type: 'active' })
      } catch {
        /* noop */
      }
    }, delay)
  }

  // When network comes back, drain any pending network failures.
  const onOnline = () => {
    if (pendingRetryKinds.has('network')) {
      pendingRetryKinds.delete('network')
      try {
        void queryClient.resumePausedMutations()
        void queryClient.invalidateQueries({ type: 'active' })
      } catch {
        /* noop */
      }
    }
  }
  window.addEventListener('online', onOnline)

  registerErrorHook((report: ErrorReport) => {
    switch (report.kind) {
      case 'network':
        pendingRetryKinds.add('network')
        if (navigator.onLine) scheduleInvalidate(1500)
        break
      case 'server':
      case 'rate_limit':
        scheduleInvalidate(report.kind === 'rate_limit' ? 5000 : 2000)
        break
      case 'chunk':
        if (onChunkStale) onChunkStale()
        break
      case 'auth':
        if (onAuthLost) onAuthLost()
        break
      default:
        break
    }
  })
}
