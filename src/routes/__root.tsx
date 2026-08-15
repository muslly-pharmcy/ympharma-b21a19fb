import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  useRouter,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { QueryClient, useQueryClient } from '@tanstack/react-query'
import { AppQueryProvider } from '@/shared/components/AppQueryProvider'
import { Suspense, useEffect, useState } from 'react'
import MainLayout from '@/layouts/MainLayout'
import { AuthProvider } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { AIProvider } from '@/context/AIContext'
import { supabase } from '@/integrations/supabase/client'
import { BottomNav } from '@/shared/components/BottomNav'
import { OfflineBanner } from '@/shared/components/OfflineBanner'
import { GlobalErrorListeners } from '@/shared/components/GlobalErrorListeners'
import { ReadingProgress } from '@/shared/components/engage/ReadingProgress'

import { ModuleErrorBoundary } from '@/components/errors/ErrorBoundary'
import { ErrorScreen } from '@/components/errors/ErrorScreen'
import { RouteSkeleton } from '@/components/skeletons/Skeleton'
import { classifyError } from '@/lib/errors/classify'
import { newCorrelationId } from '@/lib/errors/correlation'
import { reportError } from '@/lib/errors/logger'
import almoslyLogo from '@/assets/almosly-logo-optimized.webp'
import appCss from '@/index.css?url'


export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'google-site-verification', content: 'lQFe89LIGDo_qspSLYjTRLmBKT7Igmcn1adIu29LXWw' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { name: 'theme-color', content: '#005D4F' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      { title: 'صيدلية المصلي — رعاية دوائية ذكية في عدن' },
      {
        name: 'description',
        content:
          'صيدلية المصلي في عدن — صرف الوصفات، توصيل الأدوية، دليل طبي، ومساعد ذكاء صناعي على مدار الساعة.',
      },
      { property: 'og:title', content: 'صيدلية المصلي — Al-Musalli Pharmacy' },
      {
        property: 'og:description',
        content:
          'رعاية دوائية موثوقة في عدن مع مساعد ذكاء صناعي، صرف الوصفات، وتوصيل الأدوية.',
      },
      { property: 'og:site_name', content: 'صيدلية المصلي' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'صيدلية المصلي — Al-Musalli Pharmacy' },
      { name: 'twitter:description', content: 'رعاية دوائية ذكية في عدن.' },

    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/icon-192.png' },
      { rel: 'icon', type: 'image/png', sizes: '512x512', href: '/icon-512.png' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
    ],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Organization',
              '@id': 'https://muslly.com/#organization',
              name: 'صيدلية المصلي',
              alternateName: 'Almosly Pharmacy',
              url: 'https://muslly.com/',
              telephone: '+967 782 878 280',
              email: 'info@muslly.com',
              address: {
                '@type': 'PostalAddress',
                streetAddress: 'كريتر',
                addressLocality: 'عدن',
                addressCountry: 'YE',
              },
              sameAs: [
                'https://wa.me/967782878280',
              ],
            },
            {
              '@type': 'WebSite',
              '@id': 'https://muslly.com/#website',
              url: 'https://muslly.com/',
              name: 'صيدلية المصلي',
              inLanguage: 'ar',
              publisher: { '@id': 'https://muslly.com/#organization' },
              potentialAction: {
                '@type': 'SearchAction',
                target: {
                  '@type': 'EntryPoint',
                  urlTemplate: 'https://muslly.com/search?q={search_term_string}',
                },
                'query-input': 'required name=search_term_string',
              },
            },
          ],
        }),
      },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: RootNotFound,
  errorComponent: RootError,
})

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function RootComponent() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      }),
  )
  useEffect(() => {
    // Fire-and-forget: both are no-ops when their env vars are missing.
    void import('@/lib/observability/sentry').then((m) => m.initSentry()).catch(() => {})
    void import('@/lib/analytics').then((m) => m.initAnalytics()).catch(() => {})
    void import('@/lib/pwa/register').then((m) => m.registerServiceWorker()).catch(() => {})
    // Native shell only (Capacitor); a no-op in the browser build.
    void import('@/lib/native/capacitor')
      .then((m) =>
        m.registerPushNotifications((token) =>
          console.info('[push] device token registered', token.slice(0, 8) + '…'),
        ),
      )
      .catch(() => {})
  }, [])




  return (
    <AppQueryProvider client={queryClient}>
      <AuthStateSync />
      <GlobalErrorListeners />
      <OfflineBanner />
      <ReadingProgress />
      <ThemeProvider>
        <AuthProvider>
          <AIProvider>
            <MainLayout>
              <ModuleErrorBoundary boundary="root:outlet" variant="page">
                <Suspense fallback={<RouteSkeleton />}>
                  <Outlet />
                </Suspense>
              </ModuleErrorBoundary>
            </MainLayout>
            <BottomNav />
          </AIProvider>

        </AuthProvider>
      </ThemeProvider>
    </AppQueryProvider>
  )
}

// Wire Supabase auth events into the router + query cache exactly once.
// Filter to identity transitions to avoid churn on TOKEN_REFRESHED / INITIAL_SESSION.
function AuthStateSync() {
  const router = useRouter()
  const queryClient = useQueryClient()
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_IN' && event !== 'SIGNED_OUT' && event !== 'USER_UPDATED') return
      void router.invalidate()
      if (event !== 'SIGNED_OUT') void queryClient.invalidateQueries()
    })
    return () => sub.subscription.unsubscribe()
  }, [router, queryClient])
  return null
}

function RootNotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center gap-6 overflow-hidden bg-gradient-to-br from-[#D9EEEB] via-white to-[#E8F5F3] p-6 text-center">
      <div className="pointer-events-none absolute -top-24 -left-16 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />

      <img
        src={almoslyLogo}
        alt="صيدلية المصلي"
        className="relative h-32 w-32 object-contain md:h-40 md:w-40"
      />
      <div className="relative space-y-2">
        <p className="text-6xl font-black text-primary md:text-7xl">404</p>
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">الصفحة غير موجودة</h1>
        <p className="mx-auto max-w-md text-sm text-gray-600 md:text-base">
          الرابط الذي طلبته غير متاح أو تم نقله. يمكنك العودة إلى الصفحة الرئيسية لصيدلية المصلي.
        </p>
      </div>
      <div className="relative flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/"
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20 transition hover:bg-primary/90"
        >
          العودة للرئيسية
        </Link>
        <Link
          to="/contact"
          className="rounded-xl border border-primary/30 bg-white/70 px-6 py-2.5 text-sm font-semibold text-primary backdrop-blur transition hover:bg-primary/5"
        >
          تواصل معنا
        </Link>
      </div>
    </div>
  )
}


function RootError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter()
  const classified = classifyError(error)
  const correlationId = newCorrelationId('root')
  reportError({ correlationId, classified, boundary: 'root' })
  return (
    <div className="min-h-dvh bg-background">
      <ErrorScreen
        classified={classified}
        correlationId={correlationId}
        boundary="root"
        variant="page"
        onRetry={() => {
          reset()
          void router.invalidate()
        }}
      />
    </div>
  )
}
