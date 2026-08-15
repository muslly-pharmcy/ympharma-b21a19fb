import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

// ---------------------------------------------------------------------------
// Google Custom Search (image) → catalog_products.image_url
// Admin-gated, batched, rate-limit friendly. Never throws per product:
// a product without a usable image is simply reported as `skipped`.
// ---------------------------------------------------------------------------

const IMG_EXT = /\.(jpe?g|png|webp)(\?|$)/i

/** Reputable pharma / medical directory hosts get a ranking bonus. */
const PREFERRED_HOSTS = [
  'dawaback', 'altibbi', 'vidal', 'webteb', 'drugs.com', 'medicines',
  'pharmacy', 'pharma', 'sehatok', 'edrugstore', 'nahdionline', 'aldawaa',
  'unitedpharmacies', 'chemist', 'boots', 'wellcare', 'sidalih', 'tebcan',
]

interface CseItem {
  link?: string
  mime?: string
  image?: { width?: number; height?: number; contextLink?: string }
}

function scoreItem(item: CseItem): number {
  const link = item.link ?? ''
  if (!IMG_EXT.test(link)) return -1
  if (!/^https:\/\//i.test(link)) return -1
  const w = item.image?.width ?? 0
  const h = item.image?.height ?? 0
  if (w && h && (w < 200 || h < 200)) return -1
  let score = (w || 300) * (h || 300)
  const host = (() => {
    try {
      return new URL(link).hostname.toLowerCase()
    } catch {
      return ''
    }
  })()
  if (PREFERRED_HOSTS.some((p) => host.includes(p))) score *= 1.6
  return score
}

async function searchImage(
  query: string,
  key: string,
  cx: string,
): Promise<{ url: string | null; error?: string }> {
  const params = new URLSearchParams({
    key,
    cx,
    q: query,
    searchType: 'image',
    imgType: 'photo',
    imgSize: 'large',
    safe: 'active',
    num: '5',
  })
  const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params.toString()}`)
  if (!res.ok) {
    const detail = await res.text()
    if (res.status === 401 || res.status === 403) {
      return {
        url: null,
        error: 'مفتاح جوجل غير صالح أو Custom Search API غير مُفعّل',
      }
    }
    return { url: null, error: `google_${res.status}: ${detail.slice(0, 160)}` }
  }

  const json = (await res.json()) as { items?: CseItem[] }
  const ranked = (json.items ?? [])
    .map((item) => ({ item, score: scoreItem(item) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
  return { url: ranked[0]?.item.link ?? null }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', ['admin', 'owner'])
    .limit(1)
  if (!data || data.length === 0) throw new Error('صلاحيات المشرف مطلوبة')
}

export interface ImageSearchResult {
  productId: string
  name: string
  ok: boolean
  imageUrl?: string
  reason?: string
}

/** How many products still need a Google-sourced image. */
export const getGoogleImageProgress = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const [{ count: total }, { count: withImage }] = await Promise.all([
      supabaseAdmin.from('catalog_products').select('id', { count: 'exact', head: true }),
      supabaseAdmin
        .from('catalog_products')
        .select('id', { count: 'exact', head: true })
        .not('image_url', 'is', null),
    ])
    return {
      total: total ?? 0,
      withImage: withImage ?? 0,
      missing: (total ?? 0) - (withImage ?? 0),
    }
  })

export const fetchProductImagesFromGoogle = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        batchSize: z.number().int().min(1).max(10).default(8),
        force: z.boolean().default(false),
        productIds: z.array(z.string().uuid()).max(10).optional(),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId)

    const key = process.env['GOOGLE_API_KEY']
    const cx = process.env['GOOGLE_CX_ID']
    if (!key || !cx) throw new Error('مفاتيح بحث جوجل غير مهيأة')

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { recordAiCall } = await import('./observability.server')

    let query = supabaseAdmin
      .from('catalog_products')
      .select('id, name_ar, name_en, brand, image_url')
      .order('created_at', { ascending: true })
      .limit(data.batchSize)

    if (data.productIds?.length) query = query.in('id', data.productIds)
    else if (!data.force) query = query.is('image_url', null)

    const { data: products, error } = await query
    if (error) throw new Error(error.message)

    const results: ImageSearchResult[] = []

    for (const p of products ?? []) {
      const name = (p.name_ar || p.name_en || '').trim()
      if (!name) {
        results.push({ productId: p.id, name: '—', ok: false, reason: 'no_name' })
        continue
      }

      const startedAt = Date.now()
      try {
        let found = await searchImage(`${name} دواء علبة`, key, cx)
        if (!found.url && !found.error) found = await searchImage(`${name} صيدلية`, key, cx)

        if (!found.url) {
          void recordAiCall({
            feature: 'product-image-search',
            model: 'google-cse',
            backend: 'google',
            ok: false,
            latencyMs: Date.now() - startedAt,
            errorClass: found.error ? 'upstream' : 'malformed',
          })
          results.push({
            productId: p.id,
            name,
            ok: false,
            reason: found.error ?? 'no_image_found',
          })
        } else {
          const { error: upErr } = await supabaseAdmin
            .from('catalog_products')
            .update({ image_url: found.url } as never)
            .eq('id', p.id)
          if (upErr) {
            results.push({ productId: p.id, name, ok: false, reason: upErr.message })
          } else {
            void recordAiCall({
              feature: 'product-image-search',
              model: 'google-cse',
              backend: 'google',
              ok: true,
              latencyMs: Date.now() - startedAt,
            })
            results.push({ productId: p.id, name, ok: true, imageUrl: found.url })
          }
        }
      } catch (e) {
        results.push({ productId: p.id, name, ok: false, reason: (e as Error).message })
      }

      // gentle pacing to stay inside Google CSE rate limits
      await sleep(300)
    }

    const { count: remaining } = await supabaseAdmin
      .from('catalog_products')
      .select('id', { count: 'exact', head: true })
      .is('image_url', null)

    return {
      processed: results.length,
      updated: results.filter((r) => r.ok).length,
      skipped: results.filter((r) => !r.ok).length,
      remaining: remaining ?? 0,
      results,
    }
  })
