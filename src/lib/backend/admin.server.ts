import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'
import { getPublicSupabaseConfig, matchingServerCredential } from '@/integrations/supabase/public-config'

export function getMatchingServerCredential(): string | undefined {
  return matchingServerCredential(process.env)
}
export function isSupabaseAdminConfigured(): boolean {
  return Boolean(getMatchingServerCredential())
}
let client: ReturnType<typeof createClient<Database>> | undefined
function getAdmin() {
  const key = getMatchingServerCredential()
  if (!key) throw new Error('Matching selected-project server credential is unavailable; privileged operations are disabled')
  const { url } = getPublicSupabaseConfig()
  if (!url) throw new Error('Public backend URL missing')
  if (!client) client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers)
      if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization')
      headers.set('apikey', key)
      return fetch(input, { ...init, headers })
    } },
  })
  return client
}
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(_, prop) {
    const instance = getAdmin()
    const value = Reflect.get(instance, prop)
    return typeof value === 'function' ? value.bind(instance) : value
  },
})