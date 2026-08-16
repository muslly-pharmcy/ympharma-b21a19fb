import { createMiddleware } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'

export const NATIVE_APP_ORIGINS = new Set([
  'https://localhost',
  'capacitor://localhost',
])

function isNativeOrigin(origin: string | null): origin is string {
  return origin !== null && NATIVE_APP_ORIGINS.has(origin)
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'Authorization, Content-Type, X-TSR-ServerFn',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

/** Limit cross-origin RPC access to the two production Capacitor origins. */
export const nativeCorsMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ next, request, handlerType }) => {
    const origin = request.headers.get('Origin')
    if (handlerType !== 'serverFn' || !isNativeOrigin(origin)) return next()

    const headers = corsHeaders(origin)
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers })
    }

    for (const [name, value] of Object.entries(headers)) {
      setResponseHeader(name, value)
    }
    return next()
  },
)

