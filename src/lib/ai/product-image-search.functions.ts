import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import type { SkipReason } from './product-image-search.server'

// ---------------------------------------------------------------------------
// Google Custom Search (image) → catalog_products.image_url
// Admin-gated, batched, multi-key with rotation. Never throws per product:
// a product without a usable image is simply reported as `skipped`.
// ---------------------------------------------------------------------------

export interface ImageSearchResult {
  productId: string
  name: string
  ok: boolean
  imageUrl?: string
  reason?: string
  skipReason?: SkipReason
}

/** How many products still need a Google-sourced image. */
export const getGoogleImageProgress = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import('./product-image-search.admin.server')
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
    const { assertAdmin } = await import('./product-image-search.admin.server')
    await assertAdmin(context.userId)

    const { KeyRotator, collectApiKeys, collectSearchEngineIds, sleep } = await import(
      './product-image-search.server'
    )

    const env = process.env as Record<string, string | undefined>
    const keys = collectApiKeys(env)
    const cxList = collectSearchEngineIds(env)
    if (keys.length === 0 || cxList.length === 0) throw new Error('مفاتيح بحث جوجل غير مهيأة')

    const signal = (() => {
      try {
        return getRequest().signal
      } catch {
        return undefined
      }
    })()

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

    const rotator = new KeyRotator(keys, cxList[0]!)
    const results: ImageSearchResult[] = []
    const reasons = { quota: 0, noImage: 0, stopped: 0, error: 0 }
    let aborted = false

    for (const p of products ?? []) {
      if (signal?.aborted || aborted) {
        aborted = true
        reasons.stopped += 1
        results.push({
          productId: p.id,
          name: (p.name_ar || p.name_en || '—').trim(),
          ok: false,
          reason: 'تم الإيقاف',
          skipReason: 'stopped',
        })
        continue
      }

      const name = (p.name_ar || p.name_en || '').trim()
      if (!name) {
        reasons.error += 1
        results.push({ productId: p.id, name: '—', ok: false, reason: 'no_name', skipReason: 'error' })
        continue
      }

      const startedAt = Date.now()
      try {
        let found = await rotator.search(`${name} دواء علبة`, signal)
        if (!found.url && !found.keyFailure) found = await rotator.search(`${name} صيدلية`, signal)

        if (!found.url) {
          const skipReason: SkipReason = found.keyFailure
            ? 'quota'
            : found.error
              ? 'error'
              : 'no_image'
          reasons[skipReason === 'no_image' ? 'noImage' : skipReason] += 1
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
            skipReason,
          })
          // all keys burned → stop the batch gracefully
          if (found.keyFailure && rotator.exhausted) {
            aborted = false
            for (const rest of (products ?? []).slice(results.length)) {
              reasons.quota += 1
              results.push({
                productId: rest.id,
                name: (rest.name_ar || rest.name_en || '—').trim(),
                ok: false,
                reason: 'نفدت حصة مفاتيح جوجل',
                skipReason: 'quota',
              })
            }
            break
          }
        } else {
          const { error: upErr } = await supabaseAdmin
            .from('catalog_products')
            .update({ image_url: found.url } as never)
            .eq('id', p.id)
          if (upErr) {
            reasons.error += 1
            results.push({
              productId: p.id,
              name,
              ok: false,
              reason: upErr.message,
              skipReason: 'error',
            })
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
        if ((e as Error)?.name === 'AbortError') {
          aborted = true
          reasons.stopped += 1
          results.push({
            productId: p.id,
            name,
            ok: false,
            reason: 'تم الإيقاف',
            skipReason: 'stopped',
          })
          break
        }
        reasons.error += 1
        results.push({
          productId: p.id,
          name,
          ok: false,
          reason: (e as Error).message,
          skipReason: 'error',
        })
      }

      // gentle pacing to stay inside Google CSE rate limits
      try {
        await sleep(300, signal)
      } catch {
        aborted = true
        break
      }
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
      aborted,
      quotaExhausted: rotator.exhausted,
      keysUsed: rotator.keysUsed,
      reasons,
      results,
    }
  })
