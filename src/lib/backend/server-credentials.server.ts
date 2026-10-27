import { PUBLIC_BACKEND } from '../../../config/public-backend'

export type ServerEnvironment = Record<string, string | undefined>
export type CredentialIssue = 'missing' | 'missing_project_binding' | 'project_mismatch' | 'invalid_format' | 'configured'
export type CredentialSource = 'custom' | 'managed' | null

export interface ServerCredentialResolution {
  issue: CredentialIssue
  source: CredentialSource
  key?: string
}

/** Resolve server credentials only; this module must never enter a public bundle. */
export function resolveServerCredential(env: ServerEnvironment): ServerCredentialResolution {
  const custom = env.MUSLLY_SUPABASE_SERVICE_ROLE_KEY?.trim()
  const key = custom || env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const source: CredentialSource = custom ? 'custom' : key ? 'managed' : null
  if (!key) return { issue: 'missing', source }

  const binding = custom ? env.MUSLLY_SUPABASE_PROJECT_ID?.trim() : env.SUPABASE_PROJECT_ID?.trim()
  if (custom && binding && binding !== PUBLIC_BACKEND.projectId) return { issue: 'project_mismatch', source }

  if (key.startsWith('sb_secret_')) {
    if (custom && !binding) return { issue: 'missing_project_binding', source }
    if (binding !== PUBLIC_BACKEND.projectId || (!custom && env.SUPABASE_URL?.trim() !== PUBLIC_BACKEND.url)) {
      return { issue: 'project_mismatch', source }
    }
    return { issue: 'configured', source, key }
  }

  if (key.split('.').length !== 3) return { issue: 'invalid_format', source }
  try {
    const payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(atob(payload)) as { role?: string; ref?: string } | null
    if (claims?.role !== 'service_role') return { issue: 'invalid_format', source }
    if (claims.ref !== PUBLIC_BACKEND.projectId) return { issue: 'project_mismatch', source }
    // Legacy keys identify their own project. Do not reject a genuinely matching
    // key merely because an unrelated managed public URL still points elsewhere.
    // Configuration is not proof of authenticity: the selected Supabase API
    // validates the JWT signature on every request and in the readiness probe.
    return { issue: 'configured', source, key }
  } catch { return { issue: 'invalid_format', source } }
}

export function matchingServerCredential(env: ServerEnvironment): string | undefined {
  return resolveServerCredential(env).key
}

type BucketState = 'not_checked' | 'missing' | 'private' | 'public'
export interface ServerBackendReadiness {
  projectId: string
  configuration: { issue: CredentialIssue; source: CredentialSource }
  connection: 'not_checked' | 'verified' | 'rejected' | 'unavailable'
  productImages: BucketState
  catalogMedia: BucketState
}

export interface BucketProbeResult {
  data: Array<{ id: string; public: boolean }> | null
  error: unknown
}

/** Only metadata leaves this function; credentials and SDK error bodies do not. */
export async function inspectServerBackend(
  env: ServerEnvironment,
  probe: (key: string) => Promise<BucketProbeResult>,
): Promise<ServerBackendReadiness> {
  const credential = resolveServerCredential(env)
  const result: ServerBackendReadiness = {
    projectId: PUBLIC_BACKEND.projectId,
    configuration: { issue: credential.issue, source: credential.source },
    connection: 'not_checked', productImages: 'not_checked', catalogMedia: 'not_checked',
  }
  if (!credential.key) return result
  try {
    const { data, error } = await probe(credential.key)
    if (error) {
      const detail = typeof error === 'object' ? error as { status?: unknown; statusCode?: unknown } : null
      const status = Number(detail?.status ?? detail?.statusCode)
      return { ...result, connection: status === 401 || status === 403 ? 'rejected' : 'unavailable' }
    }
    const bucketState = (id: string): BucketState => {
      const bucket = data?.find((item) => item.id === id)
      return !bucket ? 'missing' : bucket.public ? 'public' : 'private'
    }
    return { ...result, connection: 'verified', productImages: bucketState('product-images'), catalogMedia: bucketState('catalog-media') }
  } catch { return { ...result, connection: 'unavailable' } }
}
