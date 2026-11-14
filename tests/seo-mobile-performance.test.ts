import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { lowBandwidthSrc, buildSrcSet } from '@/lib/store/product-images'
import { DRUG_GUIDES } from '@/lib/content/drug-guides'

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('storefront SEO and mobile loading guards', () => {
  it('keeps the public home page light without reducing the full shop page size', () => {
    expect(read('src/routes/index.tsx')).toContain('page: 1, pageSize: 8')
    expect(read('src/pages/Storefront.tsx')).toContain('page: 1, pageSize: 8')
    expect(read('src/routes/shop.tsx')).toContain('const PAGE_SIZE = 24')
  })

  it('does not load WebGL on narrow screens or when data saver is enabled', () => {
    const backdrop = read('src/shared/components/AmbientBackdrop.tsx')
    expect(backdrop).toContain("matchMedia('(min-width: 1024px)')")
    expect(backdrop).toContain('!connection?.saveData')
    expect(backdrop).toContain('!reducedMotion.matches')
  })

  it('requests small responsive images where the remote image URL supports widths', () => {
    const url = 'https://images.unsplash.com/photo-123?auto=format&w=800&q=68'
    expect(lowBandwidthSrc(url)).toContain('w=240')
    expect(buildSrcSet(url)).toContain('w=240')
    expect(buildSrcSet(url)).toContain('w=400')
    expect(lowBandwidthSrc('https://example.org/approved.jpg')).toBe('https://example.org/approved.jpg')
  })

  it('keeps all educational guide SEO titles within sixty characters', () => {
    for (const guide of DRUG_GUIDES) {
      expect(guide.metaTitle.length, guide.slug).toBeLessThanOrEqual(60)
    }
  })

  it('never labels the official regulatory reference price a confirmed selling price in SEO metadata', () => {
    const product = read('src/routes/product.$productId.tsx')
    const head = product.slice(product.indexOf('head: ({ params, loaderData })'), product.indexOf('component: ProductDetailPage'))
    expect(head).not.toContain('sbdma_official_price')
    expect(head).toContain('يُؤكّد السعر والتوفر')
  })
})
