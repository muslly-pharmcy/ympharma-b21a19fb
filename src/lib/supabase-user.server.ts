import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'
import { getPublicSupabaseConfig } from '@/integrations/supabase/public-config'

/** Fresh per-request client. Supabase validates the caller token and enforces RLS. */
export function createCallerSupabaseClient(token: string): SupabaseClient<Database> {
  const { url, publishableKey } = getPublicSupabaseConfig()
  if (!url || !publishableKey) throw new Error('Public authentication configuration is unavailable')

  return createClient<Database>(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
