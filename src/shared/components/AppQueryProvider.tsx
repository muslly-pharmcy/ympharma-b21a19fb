import { useEffect, useState, type ReactNode } from 'react'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { PUBLIC_BACKEND } from '../../../config/public-backend'

/**
 * Persist only public storefront reads, scoped to the selected project.
 * Keep one provider type throughout hydration so storage setup never
 * remounts route forms or resets input entered while the page is loading.
 */
const PERSIST_KEYS = new Set(['storefront'])

export function AppQueryProvider({
  client,
  children,
}: {
  client: QueryClient
  children: ReactNode
}) {
  const [persister, setPersister] = useState(() =>
    createSyncStoragePersister({ storage: undefined }),
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      // Older caches included private cart, order and inventory queries.
      window.localStorage.removeItem('almosly-query-cache-v1')
      window.localStorage.removeItem(`almosly-query-cache-v2-${PUBLIC_BACKEND.projectId}`)
      setPersister(
        createSyncStoragePersister({
          storage: window.localStorage,
          key: `almosly-public-cache-v3-${PUBLIC_BACKEND.projectId}`,
          throttleTime: 1500,
        }),
      )
    } catch {
      /* localStorage unavailable (private mode) — fall back silently */
    }
  }, [])

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000, // 24h
        dehydrateOptions: {
          shouldDehydrateQuery: (q) => {
            const root = Array.isArray(q.queryKey) ? String(q.queryKey[0]) : ''
            return PERSIST_KEYS.has(root) && q.state.status === 'success'
          },
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
