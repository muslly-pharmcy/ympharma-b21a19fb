import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getPublicSupabaseConfig } from '@/integrations/supabase/public-config'

// Server-side publishable client for public read-only Data API access.
// Uses the publishable/anon key; RLS applies as `anon` role.
// Keep this file server-only (`.server.ts` filename enforces the boundary).

let cached: SupabaseClient | null = null

export function getPublicSupabase(): SupabaseClient {
  if (cached) return cached
  const { url, publishableKey: key } = getPublicSupabaseConfig()
  if (!url || !key) {
    throw new Error('Supabase URL/publishable key are not configured on the server')
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers)
        if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) {
          headers.delete('Authorization')
        }
        headers.set('apikey', key)
        return fetch(input, { ...init, headers })
      },
    },
  })
  return cached
}
