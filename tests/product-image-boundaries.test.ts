import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('private product-image boundaries', () => {
  it('reads private media and signs URLs only through the server client', () => {
    const storefront = source('src/lib/storefront.functions.ts')
    const imageHandler = storefront.slice(
      storefront.indexOf('export const listProductImageUrls'),
      storefront.indexOf('// ---------- Authenticated: place order ----------'),
    )

    expect(imageHandler).toContain("'@/integrations/supabase/client.server'")
    expect(imageHandler).toContain('if (!isSupabaseAdminConfigured()) return []')
    expect(imageHandler).toContain("supabaseAdmin\n      .from('catalog_product_media')")
    expect(imageHandler).toContain('supabaseAdmin.storage')
    expect(imageHandler).not.toContain("await supabase\n      .from('catalog_product_media')")
    expect(imageHandler).toContain("'alt_text' in m.metadata")
  })
})
