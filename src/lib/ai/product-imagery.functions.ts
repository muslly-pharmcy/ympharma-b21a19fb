import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { PRODUCT_IMAGE_MAX_BYTES } from '../catalog-media-policy'

// ---------------------------------------------------------------------------
// Nano Banana high-res product imagery pipeline.
// Renders studio-grade pharma packaging shots and stores them in the
// `product-images` bucket, registering a `catalog_product_media` row.
// Authenticated + admin-gated: image generation is a billable operation.
// ---------------------------------------------------------------------------

const IMAGE_MODEL = 'google/gemini-3.1-flash-image'

function buildPrompt(p: {
  name_ar?: string | null
  name_en?: string | null
  brand?: string | null
  dosage_form?: string | null
}): string {
  const label = [p.name_en || p.name_ar, p.brand].filter(Boolean).join(' ')
  const form = p.dosage_form ? `${p.dosage_form} pharmaceutical packaging` : 'pharmaceutical box packaging'
  return [
    `Ultra clean studio product photograph of ${form} for "${label}".`,
    'Modern minimal pharmacy branding, soft teal and white palette, subtle gold accent.',
    'Centered composition, crystal clear focus, soft diffused studio lighting,',
    'seamless light background, high resolution 3D product render, no text artifacts, no people.',
  ].join(' ')
}

async function generatePng(prompt: string, key: string): Promise<Uint8Array | null> {
  const startedAt = Date.now()
  const { recordAiCall } = await import('./observability.server')
  const { classifyAiFailure } = await import('./error-classify')
  const res = await fetch('https://ai.gateway.lovable.dev/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image', 'text'],
    }),
  })
  if (!res.ok) {
    const detail = await res.text()
    const klass = classifyAiFailure(res.status, detail)
    void recordAiCall({
      feature: 'product-imagery',
      model: IMAGE_MODEL,
      backend: 'gateway',
      ok: false,
      latencyMs: Date.now() - startedAt,
      errorClass: klass,
    })
    console.error('[nano-banana]', klass, res.status)
    return null
  }
  const json = (await res.json()) as { data?: { b64_json?: string }[] }
  const b64 = json.data?.[0]?.b64_json
  if (!b64) {
    void recordAiCall({
      feature: 'product-imagery',
      model: IMAGE_MODEL,
      backend: 'gateway',
      ok: false,
      latencyMs: Date.now() - startedAt,
      errorClass: 'malformed',
    })
    return null
  }
  void recordAiCall({
    feature: 'product-imagery',
    model: IMAGE_MODEL,
    backend: 'gateway',
    ok: true,
    latencyMs: Date.now() - startedAt,
  })
  if (b64.length > Math.ceil(PRODUCT_IMAGE_MAX_BYTES / 3) * 4) return null
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return bytes
}


export const generateProductImages = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z
      .object({
        productIds: z.array(z.string().uuid()).max(10).optional(),
        limit: z.number().int().min(1).max(10).default(3),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { getActorFromSupabase, requirePermission } = await import('../session.server')
    const { uploadCatalogImage } = await import('../catalog-media-service.server')
    const actor = await getActorFromSupabase(context.supabase, context.userId)
    requirePermission(actor, 'system.admin')
    requirePermission(actor, 'catalog.write')
    const uploadGrant = await context.supabase.rpc('has_org_permission', {
      _user_id: context.userId, _org_id: actor.organizationId, _permission: 'catalog.media.upload',
    })
    if (uploadGrant.error || uploadGrant.data !== true) throw new Error('لا تملك صلاحية رفع صور المنتجات')
    const key = process.env['LOVABLE_API_KEY']
    if (!key) throw new Error('مفتاح خدمة الذكاء الاصطناعي غير مهيأ')

    let query = context.supabase
      .from('catalog_products')
      .select('id, name_ar, name_en, brand, dosage_form')
      .eq('organization_id', actor.organizationId)
      .eq('is_public', true)
      .eq('status', 'approved')
      .limit(data.limit)

    if (data.productIds?.length) query = query.in('id', data.productIds)

    const { data: products, error } = await query
    if (error) throw new Error(error.message)

    const results: { productId: string; ok: boolean; reason?: string; status?: 'approved' | 'pending' }[] = []
    if (data.productIds?.length) {
      const selected = new Set((products ?? []).map((product) => product.id))
      for (const productId of data.productIds) {
        if (!selected.has(productId)) results.push({ productId, ok: false, reason: 'product_not_owned_or_unavailable' })
      }
    }

    for (const p of products ?? []) {
      try {
        const { count, error: mediaError } = await context.supabase
          .from('catalog_product_media')
          .select('id', { count: 'exact', head: true })
          .eq('product_id', p.id)
        if (mediaError) throw new Error(mediaError.message)
        if ((count ?? 0) > 0 && !data.productIds?.length) {
          results.push({ productId: p.id, ok: false, reason: 'already_has_media' })
          continue
        }

        const bytes = await generatePng(buildPrompt(p), key)
        if (!bytes) {
          results.push({ productId: p.id, ok: false, reason: 'generation_failed' })
          continue
        }

        const image = new Blob([Uint8Array.from(bytes).buffer], { type: 'image/png' })
        const uploaded = await uploadCatalogImage(context, {
          productId: p.id, file: image, kind: 'primary', altText: 'تصور توضيحي مولّد بالذكاء الاصطناعي للمنتج',
        })
        results.push({ productId: p.id, ok: true, status: uploaded.status })
      } catch (e) {
        results.push({ productId: p.id, ok: false, reason: (e as Error).message })
      }
    }

    return {
      generated: results.filter((r) => r.ok).length,
      skipped: results.filter((r) => !r.ok).length,
      results,
    }
  })
