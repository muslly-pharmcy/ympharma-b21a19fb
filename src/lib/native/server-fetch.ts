import { isNativePlatform } from './platform'

const DEFAULT_NATIVE_SERVER_ORIGIN = 'https://muslly.com'

function nativeServerOrigin(): string {
  const configured =
    import.meta.env.VITE_NATIVE_SERVER_ORIGIN ||
    import.meta.env.VITE_SITE_URL ||
    DEFAULT_NATIVE_SERVER_ORIGIN
  const origin = new URL(configured).origin

  if (!origin.startsWith('https://')) {
    throw new Error('Native server origin must use HTTPS')
  }

  return origin
}

/**
 * TanStack server-function URLs are intentionally relative on the website.
 * A packaged Capacitor app has a local origin, so only its RPC requests are
 * redirected to the deployed HTTPS backend. Ordinary web traffic is unchanged.
 */
export function nativeAwareServerFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (!isNativePlatform()) return fetch(input, init)

  const rawUrl =
    typeof input === 'string' || input instanceof URL ? String(input) : input.url

  if (!rawUrl.startsWith('/_serverFn/')) return fetch(input, init)

  return fetch(new URL(rawUrl, `${nativeServerOrigin()}/`), init)
}
