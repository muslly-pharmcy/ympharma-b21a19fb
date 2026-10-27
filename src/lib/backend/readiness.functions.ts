import { createServerFn } from '@tanstack/react-start'
import type { ServerBackendReadiness } from './server-credentials.server'

export const getServerBackendReadiness = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ServerBackendReadiness> => {
    const { readServerBackendReadiness } = await import('./readiness.server')
    return readServerBackendReadiness()
  },
)
