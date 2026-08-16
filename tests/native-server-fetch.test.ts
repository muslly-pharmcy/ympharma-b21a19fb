import { afterEach, describe, expect, it, vi } from 'vitest'

import { nativeAwareServerFetch } from '../src/lib/native/server-fetch'

describe('nativeAwareServerFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('keeps ordinary browser server-function calls relative', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null))
    vi.stubGlobal('fetch', fetchMock)

    await nativeAwareServerFetch('/_serverFn/catalog')

    expect(fetchMock).toHaveBeenCalledWith('/_serverFn/catalog', undefined)
  })

  it('sends only native server-function calls to the HTTPS backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('window', {
      Capacitor: { isNativePlatform: () => true },
    })

    await nativeAwareServerFetch('/_serverFn/catalog', {
      method: 'POST',
    })

    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toBe('https://muslly.com/_serverFn/catalog')
    expect(init).toEqual({ method: 'POST' })
  })

  it('does not rewrite unrelated requests in the native shell', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('window', {
      Capacitor: { isNativePlatform: () => true },
    })

    await nativeAwareServerFetch('https://example.com/health')

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/health', undefined)
  })
})

