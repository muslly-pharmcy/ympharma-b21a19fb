import { useEffect, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

/**
 * Wraps the app in QueryClientProvider, and additionally persists a
 * whitelisted subset of query cache (cart, checkout metadata, catalog) to
 * localStorage after mount. This keeps cart/checkout viewable on flaky
 * networks or transient offline periods without a Service Worker.
 *
 * SSR-safe: on server / before mount uses plain QueryClientProvider.
 */
const PERSIST_KEYS = new Set([
  'cart',
  'storefront',
  'catalog',
  'my-orders',
  'store', // /store list + /store/$code product detail
])

export function AppQueryProvider({
  client,
  children,
}: {
  client: QueryClient
  children: ReactNode
}) {
  const [persister, setPersister] = useState<ReturnType<
    typeof createSyncStoragePersister
  > | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      setPersister(
        createSyncStoragePersister({
          storage: window.localStorage,
          key: 'almosly-query-cache-v1',
          throttleTime: 1500,
        }),
      )
    } catch {
      /* localStorage unavailable (private mode) — fall back silently */
    }
  }, [])

  if (!persister) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }

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
