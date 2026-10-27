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
