import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'
import { brokeredPreviewStorage } from '@/integrations/supabase/previewAuthStorage'
import { getPublicSupabaseConfig } from '@/integrations/supabase/public-config'
import { PUBLIC_BACKEND } from '../../../config/public-backend'

export function publicKeyFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(input instanceof Request ? input.headers : undefined)
    new Headers(init?.headers).forEach((value, name) => headers.set(name, value))
    if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization')
    headers.set('apikey', key)
    return fetch(input, { ...init, headers })
  }
}

export function createPublicClient(persistSession = false) {
  const { url, publishableKey } = getPublicSupabaseConfig()
  if (!url || !publishableKey) throw new Error('Public backend configuration missing')
  return createClient<Database>(url, publishableKey, {
    global: { fetch: publicKeyFetch(publishableKey) },
    auth: {
      storageKey: `sb-${PUBLIC_BACKEND.projectId}-auth-token`,
      storage: persistSession ? brokeredPreviewStorage() : undefined,
      persistSession,
      autoRefreshToken: persistSession,
      detectSessionInUrl: persistSession,
    },
  })
}

let client: ReturnType<typeof createPublicClient> | undefined
export function getSupabaseClient() {
  if (!client) client = createPublicClient(typeof window !== 'undefined')
  return client
}
// Imports are inert. Configuration and browser storage are read only on use.
export const supabase = new Proxy({} as ReturnType<typeof createPublicClient>, {
  get(_, prop) {
    const instance = getSupabaseClient()
    const value = Reflect.get(instance, prop)
    return typeof value === 'function' ? value.bind(instance) : value
  },
})