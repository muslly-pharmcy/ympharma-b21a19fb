// Public assets only. Never cache account HTML, API responses or patient data.
// Bump this version when changing the offline page or caching policy.
const OFFLINE_CACHE = 'muslly-offline-v4-ybhrmcdlgyccywpmiucz'
const ASSET_CACHE = 'muslly-assets-v4-ybhrmcdlgyccywpmiucz'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then((cache) => cache.add(OFFLINE_URL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) =>
      (key.startsWith('muslly-') || key.startsWith('workbox-') || key.startsWith('html-navigations') || ['api-cache', 'static-assets'].includes(key)) &&
      key !== OFFLINE_CACHE && key !== ASSET_CACHE,
    ).map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () =>
      (await caches.match(OFFLINE_URL)) || new Response('الخدمة تحتاج اتصالًا بالإنترنت', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } }),
    ))
    return
  }
  // Hash-named build assets are immutable. URLs and responses carrying user data
  // cannot enter this cache, regardless of their HTTP cache-control headers.
  if (!url.pathname.startsWith('/assets/') || !['style', 'script', 'image', 'font'].includes(request.destination)) return
  if (!/[-.][a-zA-Z0-9_-]{8,}\.(js|css|woff2?|png|webp|svg|ico)$/.test(url.pathname)) return
  event.respondWith((async () => {
    const cache = await caches.open(ASSET_CACHE)
    const cached = await cache.match(request)
    if (cached) return cached
    const response = await fetch(request)
    if (response.ok && response.type === 'basic') {
      event.waitUntil((async () => {
        await cache.put(request, response.clone())
        const keys = await cache.keys()
        await Promise.all(keys.slice(0, Math.max(0, keys.length - 120)).map((key) => cache.delete(key)))
      })().catch(() => {}))
    }
    return response
  })())
})
