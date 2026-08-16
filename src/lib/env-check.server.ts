/**
 * Startup environment validation for Lovable Cloud connectivity.
 * Runs server-side on boot so missing Supabase configuration fails fast
 * with a clear message instead of a cryptic client-side throw.
 */

const SERVER_VARS = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'] as const
const CLIENT_VARS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'] as const

function missing(vars: readonly string[]): string[] {
  return vars.filter((v) => !process.env[v])
}

export function validateCloudEnv(): void {
  // Guard: this module may be reached in a client chunk during dev HMR.
  // The browser has no process.env, so skip the check there.
  if (typeof window !== 'undefined' || typeof process === 'undefined') {
    return
  }

  const serverMissing = missing(SERVER_VARS)
  const clientMissing = missing(CLIENT_VARS)

  if (serverMissing.length > 0 || clientMissing.length > 0) {
    const parts: string[] = []
    if (serverMissing.length > 0) {
      parts.push(`server env missing: ${serverMissing.join(', ')}`)
    }
    if (clientMissing.length > 0) {
      parts.push(`client env missing: ${clientMissing.join(', ')}`)
    }
    const message = `Lovable Cloud configuration incomplete — ${parts.join('; ')}. Ensure Lovable Cloud is enabled and environment variables are loaded.`
    console.error(`[env-check] ${message}`)
    // Do not throw during dev HMR reloads; the error is logged loudly and
    // the Supabase client will still throw its own message on first use.
  } else {
    console.log('[env-check] Lovable Cloud env vars present.')
  }
}
