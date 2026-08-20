export type PublicSupabaseEnv = Record<string, string | undefined>

export type PublicSupabaseConfig = {
  url: string | undefined
  publishableKey: string | undefined
}

function firstConfigured(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0)
}

/**
 * Resolve the public Supabase connection from either server runtime variables
 * or Vite's build-time variables. Lovable Cloud may expose the public values
 * through either source depending on whether code runs in a worker or browser.
 */
export function resolvePublicSupabaseConfig(
  runtimeEnv: PublicSupabaseEnv = {},
  buildEnv: PublicSupabaseEnv = {},
): PublicSupabaseConfig {
  return {
    url: firstConfigured(
      runtimeEnv.SUPABASE_URL,
      runtimeEnv.VITE_SUPABASE_URL,
      buildEnv.VITE_SUPABASE_URL,
      buildEnv.SUPABASE_URL,
    ),
    publishableKey: firstConfigured(
      runtimeEnv.SUPABASE_PUBLISHABLE_KEY,
      runtimeEnv.VITE_SUPABASE_PUBLISHABLE_KEY,
      runtimeEnv.VITE_SUPABASE_ANON_KEY,
      buildEnv.VITE_SUPABASE_PUBLISHABLE_KEY,
      buildEnv.VITE_SUPABASE_ANON_KEY,
      buildEnv.SUPABASE_PUBLISHABLE_KEY,
    ),
  }
}

export function getPublicSupabaseConfig(): PublicSupabaseConfig {
  const runtimeEnv =
    typeof process !== 'undefined' ? (process.env as PublicSupabaseEnv) : {}
  const buildEnv = import.meta.env as unknown as PublicSupabaseEnv
  return resolvePublicSupabaseConfig(runtimeEnv, buildEnv)
}
