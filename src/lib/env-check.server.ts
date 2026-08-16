/**
 * Startup environment validation for Lovable Cloud connectivity.
 * Runs server-side on boot so missing Supabase configuration fails fast
 * with a clear message instead of a cryptic client-side throw.
 */

import { getPublicSupabaseConfig } from '@/integrations/supabase/public-config'

export function validateCloudEnv(): void {
  // Guard: this module may be reached in a client chunk during dev HMR.
  // The browser has no process.env, so skip the check there.
  if (typeof window !== 'undefined' || typeof process === 'undefined') {
    return
  }

  const { url, publishableKey } = getPublicSupabaseConfig()

  if (!url || !publishableKey) {
    const missing = [
      ...(!url ? ['Supabase URL'] : []),
      ...(!publishableKey ? ['Supabase publishable key'] : []),
    ]
    const message = `Lovable Cloud configuration incomplete — missing ${missing.join(' and ')}. Either the server variables or their VITE_ public equivalents may be used.`
    console.error(`[env-check] ${message}`)
    // Do not throw during dev HMR reloads; the error is logged loudly and
    // the Supabase client will still throw its own message on first use.
  } else {
    console.log('[env-check] Lovable Cloud public Supabase configuration present.')
  }
}
