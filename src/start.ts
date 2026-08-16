import { createCsrfMiddleware, createStart } from '@tanstack/react-start'
import { attachSupabaseAuth } from '@/integrations/supabase/auth-attacher'
import { securityHeadersMiddleware } from '@/lib/security/headers.server'
import { nativeCorsMiddleware, NATIVE_APP_ORIGINS } from '@/lib/security/native-cors.server'
import { nativeAwareServerFetch } from '@/lib/native/server-fetch'

const csrfMiddleware = createCsrfMiddleware({
  filter: ({ handlerType }) => handlerType === 'serverFn',
  origin: (origin, { request }) =>
    origin === new URL(request.url).origin || NATIVE_APP_ORIGINS.has(origin),
  secFetchSite: (site, { request }) => {
    if (site === 'same-origin' || site === 'same-site') return true
    return NATIVE_APP_ORIGINS.has(request.headers.get('Origin') ?? '')
  },
})

export const startInstance = createStart(() => {
  // Fail fast with a clear message if Lovable Cloud env vars are missing.
  // Guarded to server-only: the browser bundle has no process.env.
  if (typeof window === 'undefined') {
    import('@/lib/env-check.server').then((m) => m.validateCloudEnv())
  }

  return {
    requestMiddleware: [nativeCorsMiddleware, csrfMiddleware, securityHeadersMiddleware],
    functionMiddleware: [attachSupabaseAuth],
    serverFns: { fetch: nativeAwareServerFetch },
  }
})
