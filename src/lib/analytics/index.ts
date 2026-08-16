// Analytics scaffold. Zero-effect until real IDs are provided via env.
// Wire GA4 / GTM later by setting VITE_GA_MEASUREMENT_ID / VITE_GTM_ID.
// This module never injects placeholder or fake IDs.

type Params = Record<string, unknown>

interface Provider {
  name: string
  pageview(path: string): void
  track(event: string, params?: Params): void
}

const providers: Provider[] = []

export function initAnalytics(): void {
  if (typeof window === 'undefined') return
  const ga4 = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined
  const gtm = import.meta.env.VITE_GTM_ID as string | undefined

  if (ga4 && /^G-[A-Z0-9]+$/i.test(ga4)) {
    // Inject GA4 only when a real Measurement ID is present.
    const s = document.createElement('script')
    s.async = true
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4)}`
    document.head.appendChild(s)
    const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void }
    w.dataLayer = w.dataLayer ?? []
    w.gtag = (...args: unknown[]) => { w.dataLayer!.push(args) }
    w.gtag('js', new Date())
    w.gtag('config', ga4, { anonymize_ip: true, send_page_view: false })
    providers.push({
      name: 'ga4',
      pageview: (path) => w.gtag?.('event', 'page_view', { page_path: path }),
      track: (event, params) => w.gtag?.('event', event, params ?? {}),
    })
  }

  if (gtm && /^GTM-[A-Z0-9]+$/i.test(gtm)) {
    const w = window as unknown as { dataLayer?: unknown[] }
    w.dataLayer = w.dataLayer ?? []
    w.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
    const s = document.createElement('script')
    s.async = true
    s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtm)}`
    document.head.appendChild(s)
    providers.push({
      name: 'gtm',
      pageview: (path) => w.dataLayer!.push({ event: 'page_view', page_path: path }),
      track: (event, params) => w.dataLayer!.push({ event, ...(params ?? {}) }),
    })
  }
}

export function trackPageview(path: string): void {
  for (const p of providers) p.pageview(path)
}
export function trackEvent(event: string, params?: Params): void {
  for (const p of providers) p.track(event, params)
}
export function isAnalyticsEnabled(): boolean {
  return providers.length > 0
}
