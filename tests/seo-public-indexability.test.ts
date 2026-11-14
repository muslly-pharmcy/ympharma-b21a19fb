import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('public SEO metadata and crawl policy', () => {
  it('renders exactly one primary H1 across the home hero sections', () => {
    const homeSections = read('src/shared/components/home/GlassHero.tsx') +
      read('src/components/store/HeroBanner.tsx')
    expect((homeSections.match(/<h1\b/g) ?? []).length).toBe(1)
  })

  it('provides an absolute site-wide social sharing image', () => {
    const root = read('src/routes/__root.tsx')
    expect(root).toContain("{ property: 'og:image', content: 'https://muslly.com/icon-512.png' }")
    expect(root).toContain("{ name: 'twitter:image', content: 'https://muslly.com/icon-512.png' }")
  })

  it('has canonical URLs for the homepage and shop index', () => {
    expect(read('src/routes/index.tsx')).toContain("rel: 'canonical', href: 'https://muslly.com/'")
    expect(read('src/routes/shop.tsx')).toContain("rel: 'canonical', href: 'https://muslly.com/shop'")
  })

  it('keeps search, authentication and recovery screens out of the index', () => {
    expect(read('src/routes/search.tsx')).toContain("name: 'robots', content: 'noindex, follow'")
    expect(read('src/routes/auth.tsx')).toContain("name: 'robots', content: 'noindex'")
    expect(read('src/routes/reset-password.tsx')).toContain("name: 'robots', content: 'noindex, nofollow, noarchive'")
    expect(read('src/routes/_authenticated/route.tsx')).toContain("name: 'robots', content: 'noindex, nofollow, noarchive'")
    expect(read('src/routes/mission-control.tsx')).toContain("name: 'robots', content: 'noindex, nofollow, noarchive'")
    expect(read('src/routes/planet.$planetId.tsx')).toContain("name: 'robots', content: 'noindex, nofollow, noarchive'")
  })

  it('only exposes relevant public routes in the static sitemap', () => {
    const sitemap = read('src/routes/sitemap[.]xml.ts')
    expect(sitemap).not.toContain("path: '/auth'")
    expect(sitemap).not.toContain("path: '/search'")
    expect(sitemap).not.toContain("path: '/ai-chat'")
    expect(sitemap).toContain("path: '/policies'")
    expect(sitemap).toContain(".eq('is_public', true)")
    expect(sitemap).toContain(".eq('status', 'approved')")
  })

  it('does not falsely assert availability for reference-priced products', () => {
    const product = read('src/routes/product.$productId.tsx')
    expect(product).not.toContain("availability: 'https://schema.org/InStock'")
    expect(product).toContain("name: 'robots', content: 'noindex, follow'")
  })

  it('declares the sitemap and excludes machine endpoints from crawler access', () => {
    const robots = read('public/robots.txt')
    expect(robots).toContain('Sitemap: https://muslly.com/sitemap.xml')
    expect(robots).toContain('Disallow: /api/')
    expect(robots).not.toContain('Disallow: /search')
  })
})
