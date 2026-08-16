import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Clinical & descriptive content engine for storefront products.
// Generates Arabic dosage guides, ingredients, precautions and benefits, then
// caches the result on `catalog_products.metadata.ai_guide` so repeat visitors
// never pay for a second generation.
// ---------------------------------------------------------------------------

export interface ProductAiGuide {
  summary: string
  indications: string[]
  dosage: string[]
  ingredients: string[]
  precautions: string[]
  benefits: string[]
  generated_at: string
}

const guideShape = z.object({
  summary: z.string().default(''),
  indications: z.array(z.string()).default([]),
  dosage: z.array(z.string()).default([]),
  ingredients: z.array(z.string()).default([]),
  precautions: z.array(z.string()).default([]),
  benefits: z.array(z.string()).default([]),
})

const SYSTEM_PROMPT = `أنت صيدلي إكلينيكي خبير تكتب محتوى منتجات صيدلية باللغة العربية الفصحى المبسطة.
اكتب معلومات دقيقة وآمنة فقط، وتجنّب أي ادعاءات علاجية غير مثبتة.
أعِد النتيجة بصيغة JSON فقط بالمفاتيح:
summary (سطران)، indications، dosage، ingredients، precautions، benefits (مصفوفات نصية قصيرة).
اذكر دائماً ضرورة مراجعة الطبيب أو الصيدلي ضمن precautions.`

export const getProductAiGuide = createServerFn({ method: 'POST' })
  .validator((raw: unknown) =>
    z.object({ productId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data }): Promise<ProductAiGuide | null> => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    const { data: product } = await supabaseAdmin
      .from('catalog_products')
      .select(
        'id, name_ar, name_en, generic_name, brand, dosage_form, strength, active_ingredients, description_ar, metadata, is_public, status',
      )
      .eq('id', data.productId)
      .eq('is_public', true)
      .eq('status', 'approved')
      .maybeSingle()

    if (!product) return null

    const metadata = (product.metadata ?? {}) as Record<string, unknown>
    const cached = metadata.ai_guide as ProductAiGuide | undefined
    if (cached?.summary) return cached

    const key = process.env['LOVABLE_API_KEY']
    if (!key) return null

    const prompt = [
      `اسم المنتج: ${product.name_ar ?? ''} ${product.name_en ?? ''}`,
      product.generic_name ? `الاسم العلمي: ${product.generic_name}` : '',
      product.brand ? `العلامة: ${product.brand}` : '',
      product.dosage_form ? `الشكل الصيدلاني: ${product.dosage_form}` : '',
      product.strength ? `التركيز: ${product.strength}` : '',
      product.active_ingredients
        ? `المواد الفعالة: ${JSON.stringify(product.active_ingredients)}`
        : '',
      product.description_ar ? `وصف متاح: ${product.description_ar}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    const startedAt = Date.now()
    const { recordAiCall } = await import('./observability.server')
    const { classifyAiFailure, classifyThrownAi } = await import('./error-classify')

    try {
      const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Lovable-API-Key': key,
          'X-Lovable-AIG-SDK': 'fetch',
        },
        body: JSON.stringify({
          model: 'openai/gpt-5.6-sol',
          reasoning_effort: 'none',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `${prompt}\n\nأعد JSON فقط.` },
          ],
        }),
      })
      if (!res.ok) {
        const detail = await res.text()
        const klass = classifyAiFailure(res.status, detail)
        void recordAiCall({
          feature: 'product-guide',
          model: 'openai/gpt-5.6-sol',
          backend: 'gateway',
          ok: false,
          latencyMs: Date.now() - startedAt,
          errorClass: klass,
        })
        console.error('[getProductAiGuide]', klass, res.status)
        return null
      }
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[]
      }
      const content = json.choices?.[0]?.message?.content ?? ''
      const parsed = guideShape.parse(JSON.parse(content))
      const guide: ProductAiGuide = { ...parsed, generated_at: new Date().toISOString() }

      await supabaseAdmin
        .from('catalog_products')
        .update({ metadata: { ...metadata, ai_guide: guide } as unknown as never })
        .eq('id', product.id)

      void recordAiCall({
        feature: 'product-guide',
        model: 'openai/gpt-5.6-sol',
        backend: 'gateway',
        ok: true,
        latencyMs: Date.now() - startedAt,
      })
      return guide
    } catch (e) {
      const klass = classifyThrownAi(e)
      void recordAiCall({
        feature: 'product-guide',
        model: 'openai/gpt-5.6-sol',
        backend: 'gateway',
        ok: false,
        latencyMs: Date.now() - startedAt,
        errorClass: klass,
      })
      console.error('[getProductAiGuide]', klass)
      return null
    }
  })
