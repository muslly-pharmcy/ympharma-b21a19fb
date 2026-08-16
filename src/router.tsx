import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { RouteSkeleton } from '@/components/skeletons/Skeleton'
import { ErrorScreen } from '@/components/errors/ErrorScreen'
import { classifyError } from '@/lib/errors/classify'
import { newCorrelationId } from '@/lib/errors/correlation'
import { reportError } from '@/lib/errors/logger'

// Route-level default: classified error screen with retry (invalidate + reset).
function DefaultRouteError({ error, reset }: { error: Error; reset: () => void }) {
  const classified = classifyError(error)
  const correlationId = newCorrelationId('route')
  reportError({ correlationId, classified, boundary: 'route:default' })
  return (
    <ErrorScreen
      classified={classified}
      correlationId={correlationId}
      boundary="route:default"
      variant="page"
      onRetry={reset}
    />
  )
}

export function getRouter() {
  return createTanStackRouter({
    routeTree,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    defaultErrorComponent: DefaultRouteError,
    defaultPendingComponent: () => <RouteSkeleton />,
    defaultPendingMs: 200,
    defaultPendingMinMs: 300,
  })
}

// Back-compat alias for older call sites.
export const createRouter = getRouter

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
