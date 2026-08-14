import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

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
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return bytes
}

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

export const generateProductImages = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        productIds: z.array(z.string().uuid()).max(10).optional(),
        limit: z.number().int().min(1).max(10).default(3),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId)
    const key = process.env['LOVABLE_API_KEY']
    if (!key) throw new Error('مفتاح خدمة الذكاء الاصطناعي غير مهيأ')

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    let query = supabaseAdmin
      .from('catalog_products')
      .select('id, name_ar, name_en, brand, dosage_form')
      .eq('is_public', true)
      .eq('status', 'approved')
      .limit(data.limit)

    if (data.productIds?.length) query = query.in('id', data.productIds)

    const { data: products, error } = await query
    if (error) throw new Error(error.message)

    const results: { productId: string; ok: boolean; reason?: string }[] = []

    for (const p of products ?? []) {
      try {
        const { count } = await supabaseAdmin
          .from('catalog_product_media')
          .select('id', { count: 'exact', head: true })
          .eq('product_id', p.id)
        if ((count ?? 0) > 0 && !data.productIds?.length) {
          results.push({ productId: p.id, ok: false, reason: 'already_has_media' })
          continue
        }

        const bytes = await generatePng(buildPrompt(p), key)
        if (!bytes) {
          results.push({ productId: p.id, ok: false, reason: 'generation_failed' })
          continue
        }

        const path = `${p.id}/nano-${Date.now()}.png`
        const { error: upErr } = await supabaseAdmin.storage
          .from('product-images')
          .upload(path, bytes, { contentType: 'image/png', upsert: true })
        if (upErr) {
          results.push({ productId: p.id, ok: false, reason: upErr.message })
          continue
        }

        await supabaseAdmin.from('catalog_product_media').insert({
          product_id: p.id,
          storage_bucket: 'product-images',
          storage_path: path,
          kind: 'image',
          sort_order: 0,
          status: 'approved',
        } as never)

        results.push({ productId: p.id, ok: true })
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
