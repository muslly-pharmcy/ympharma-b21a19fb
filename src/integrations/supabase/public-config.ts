import { PUBLIC_BACKEND } from '../../../config/public-backend'

export type PublicSupabaseEnv = Record<string, string | undefined>

export type PublicSupabaseConfig = {
  url: string | undefined
  publishableKey: string | undefined
}

export const PUBLIC_CONFIG_ELEMENT_ID = 'muslly-public-backend'

export function validatePublicConfig(config: PublicSupabaseConfig): PublicSupabaseConfig {
  if (!config.url || !config.publishableKey) throw new Error('Public backend configuration is missing')
  if (config.url !== PUBLIC_BACKEND.url || config.publishableKey !== PUBLIC_BACKEND.publishableKey) {
    throw new Error('Public backend configuration does not match the selected project')
  }
  return { url: config.url, publishableKey: config.publishableKey }
}

/**
 * Use the owner's selected existing backend for both build and runtime.
 * Reserved managed bindings for a different project must not override it.
 */
export function resolvePublicSupabaseConfig(
  _runtimeEnv: PublicSupabaseEnv = {},
  _buildEnv: PublicSupabaseEnv = {},
): PublicSupabaseConfig {
  // A managed binding to another project must never override owner selection.
  return validatePublicConfig(PUBLIC_BACKEND)
}

export function getPublicSupabaseConfig(): PublicSupabaseConfig {
  if (typeof document !== 'undefined') {
    const json = document.getElementById(PUBLIC_CONFIG_ELEMENT_ID)?.textContent
    if (!json) throw new Error('Public backend bootstrap configuration is missing')
    return validatePublicConfig(JSON.parse(json))
  }
  return resolvePublicSupabaseConfig()
}

export function serializePublicConfig(config: PublicSupabaseConfig): string {
  const { url, publishableKey } = config
  return JSON.stringify({ url, publishableKey }).replace(/</g, '\\u003c')
}

export function matchingServerCredential(env: PublicSupabaseEnv): string | undefined {
  // Custom server-only bindings let the selected existing project work without
  // reusing reserved Lovable Cloud credentials for another project.
  const custom = env.MUSLLY_SUPABASE_SERVICE_ROLE_KEY?.trim()
  const customBinding = env.MUSLLY_SUPABASE_PROJECT_ID?.trim()
  let key: string | undefined
  if (custom) {
    if (customBinding !== PUBLIC_BACKEND.projectId) return undefined
    key = custom
  } else {
    if (env.SUPABASE_URL?.trim() !== PUBLIC_BACKEND.url || env.SUPABASE_PROJECT_ID?.trim() !== PUBLIC_BACKEND.projectId) return undefined
    key = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  }
  if (key?.startsWith('sb_secret_')) return key
  if (key?.split('.').length !== 3) return undefined
  try {
    const payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(atob(payload)) as { role?: string; ref?: string }
    return claims.role === 'service_role' && claims.ref === PUBLIC_BACKEND.projectId ? key : undefined
  } catch { return undefined }
}
