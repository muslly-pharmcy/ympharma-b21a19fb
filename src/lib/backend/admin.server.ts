import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'
import { getPublicSupabaseConfig } from '@/integrations/supabase/public-config'
import { matchingServerCredential } from './server-credentials.server'

export function getMatchingServerCredential(): string | undefined {
  return matchingServerCredential(process.env)
}
export function isSupabaseAdminConfigured(): boolean {
  return Boolean(getMatchingServerCredential())
}
let client: ReturnType<typeof createClient<Database>> | undefined
let clientKey: string | undefined

export function createSelectedAdminClient(key: string, timeoutMs?: number) {
  const { url } = getPublicSupabaseConfig()
  if (!url) throw new Error('Public backend URL missing')
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(input instanceof Request ? input.headers : undefined)
      new Headers(init?.headers).forEach((value, name) => headers.set(name, value))
      if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization')
      headers.set('apikey', key)
      return fetch(input, { ...init, headers, ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}) })
    } },
  })
}

function getAdmin() {
  const key = getMatchingServerCredential()
  if (!key) throw new Error('Matching selected-project server credential is unavailable; privileged operations are disabled')
  if (!client || clientKey !== key) {
    client = createSelectedAdminClient(key)
    clientKey = key
  }
  return client
}
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(_, prop) {
    const instance = getAdmin()
    const value = Reflect.get(instance, prop)
    return typeof value === 'function' ? value.bind(instance) : value
  },
})
