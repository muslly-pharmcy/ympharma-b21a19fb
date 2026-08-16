import { createFileRoute } from '@tanstack/react-router'
import type {} from '@tanstack/react-start'
import { DRUG_GUIDES } from '@/lib/content/drug-guides'

const BASE_URL = 'https://muslly.com'

interface SitemapEntry {
  path: string
  changefreq?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  priority?: string
  lastmod?: string
}

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        const staticEntries: SitemapEntry[] = [
          { path: '/', changefreq: 'daily', priority: '1.0' },
          { path: '/shop', changefreq: 'daily', priority: '0.9' },
          { path: '/about', changefreq: 'monthly', priority: '0.7' },
          { path: '/contact', changefreq: 'monthly', priority: '0.7' },
          { path: '/request', changefreq: 'monthly', priority: '0.8' },
          { path: '/search', changefreq: 'weekly', priority: '0.6' },
          { path: '/ai-chat', changefreq: 'monthly', priority: '0.5' },
          { path: '/auth', changefreq: 'yearly', priority: '0.3' },
          // Local SEO landing
          { path: '/delivery/aden', changefreq: 'monthly', priority: '0.9' },
          // Interactive medical tools
          { path: '/tools', changefreq: 'monthly', priority: '0.8' },
          { path: '/tools/pediatric-dose', changefreq: 'monthly', priority: '0.7' },
          { path: '/tools/interactions', changefreq: 'monthly', priority: '0.7' },
          { path: '/tools/symptoms', changefreq: 'monthly', priority: '0.7' },
          { path: '/tools/schedule', changefreq: 'monthly', priority: '0.7' },
          { path: '/tools/bmi', changefreq: 'monthly', priority: '0.7' },
          // Clinical drug guides
          { path: '/guides', changefreq: 'weekly', priority: '0.8' },
          ...DRUG_GUIDES.map((g) => ({
            path: `/guides/${g.slug}`,
            changefreq: 'monthly' as const,
            priority: '0.8',
          })),
        ]


        // Dynamic: public products
        const entries: SitemapEntry[] = [...staticEntries]
        try {
          const { getPublicSupabase } = await import('@/lib/supabase-public.server')
          const supabase = getPublicSupabase()
          const { data } = await supabase
            .from('catalog_products')
            .select('id, updated_at')
            .eq('is_public', true)
            .eq('status', 'approved')
            .order('updated_at', { ascending: false })
            .limit(500)
          for (const row of (data ?? []) as Array<{ id: string; updated_at: string }>) {
            entries.push({
              path: `/product/${row.id}`,
              changefreq: 'weekly',
              priority: '0.6',
              lastmod: row.updated_at,
            })
          }
        } catch (err) {
          console.error('[sitemap] product fetch failed', err)
        }

        const urls = entries.map((e) =>
          [
            '  <url>',
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            '  </url>',
          ]
            .filter(Boolean)
            .join('\n'),
        )

        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...urls,
          '</urlset>',
        ].join('\n')

        return new Response(xml, {
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        })
      },
    },
  },
})
