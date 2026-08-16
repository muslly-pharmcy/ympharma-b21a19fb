import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

/**
 * Gemini-powered OCR for prescription photos and lab reports.
 * Public (no PHI is stored here — the image is analysed in-memory and the
 * structured Arabic summary is returned straight to the patient's browser).
 */

const scanInput = z.object({
  /** data:image/...;base64,... payload from the browser. */
  imageData: z.string().min(64).max(9_000_000),
  mode: z.enum(['prescription', 'lab']).default('prescription'),
})

const scanSchema = z.object({
  documentType: z.string(),
  summaryAr: z.string(),
  medicines: z.array(
    z.object({
      name: z.string(),
      strength: z.string().nullable(),
      dosageAr: z.string().nullable(),
      durationAr: z.string().nullable(),
    }),
  ),
  labValues: z.array(
    z.object({ parameter: z.string(), value: z.string(), flagAr: z.string().nullable() }),
  ),
  cautionsAr: z.array(z.string()),
})

export type PrescriptionScan = z.infer<typeof scanSchema>

export interface ScanResult {
  ok: boolean
  scan: PrescriptionScan | null
  message?: string
  matches: Array<{
    id: string
    name_ar: string | null
    name_en: string | null
    sbdma_official_price: number | null
    requires_prescription: boolean
    query: string
  }>
}

export const scanPrescriptionImage = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => scanInput.parse(raw))
  .handler(async ({ data }): Promise<ScanResult> => {
    const apiKey = process.env['LOVABLE_API_KEY']
    if (!apiKey) return { ok: false, scan: null, message: 'خدمة القراءة الذكية غير مفعّلة حالياً', matches: [] }

    const { callVision } = await import('./ai/vision.server')

    const systemPrompt = [
      'أنت صيدلي سريري خبير يقرأ الوصفات الطبية وتقارير المختبر المكتوبة بخط اليد أو المطبوعة.',
      'استخرج البيانات بدقة ولا تخترع أي معلومة غير ظاهرة في الصورة.',
      'اكتب كل الملخصات والتحذيرات باللغة العربية الفصحى المبسطة.',
      'إذا كانت الصورة غير واضحة، اذكر ذلك في الملخص واترك القوائم فارغة.',
    ].join(' ')

    const userPrompt =
      data.mode === 'lab'
        ? 'حلّل تقرير المختبر في الصورة: استخرج كل مؤشر مع قيمته وحالته (طبيعي/مرتفع/منخفض) ولخّصها للمريض.'
        : 'اقرأ الوصفة الطبية في الصورة: استخرج أسماء الأدوية وتراكيزها وطريقة الاستخدام والمدة، ثم لخّصها للمريض.'

    let scan: PrescriptionScan | null
    try {
      const result = await callVision({
        systemPrompt,
        userPrompt,
        imageUrl: data.imageData,
        schema: scanSchema,
        maxOutputTokens: 1600,
      })
      scan = result.data
    } catch (err) {
      console.error('[scanPrescriptionImage]', (err as Error).message)
      return { ok: false, scan: null, message: 'تعذّرت قراءة الصورة، حاول بصورة أوضح', matches: [] }
    }

    if (!scan) {
      return { ok: false, scan: null, message: 'لم نتمكن من استخراج بيانات واضحة من الصورة', matches: [] }
    }

    // Match extracted medicine names against the public catalog.
    const matches: ScanResult['matches'] = []
    try {
      const { getPublicSupabase } = await import('./supabase-public.server')
      const supabase = getPublicSupabase()
      for (const med of scan.medicines.slice(0, 8)) {
        const term = med.name.replace(/[%_,]/g, ' ').trim()
        if (term.length < 3) continue
        const { data: rows } = await supabase
          .from('catalog_products')
          .select('id, name_ar, name_en, sbdma_official_price, requires_prescription')
          .eq('is_public', true)
          .eq('status', 'approved')
          .or(`name_ar.ilike.%${term}%,name_en.ilike.%${term}%,generic_name.ilike.%${term}%,brand.ilike.%${term}%`)
          .limit(1)
        const hit = (rows ?? [])[0] as
          | {
              id: string
              name_ar: string | null
              name_en: string | null
              sbdma_official_price: number | null
              requires_prescription: boolean
            }
          | undefined
        if (hit) matches.push({ ...hit, query: med.name })
      }
    } catch (err) {
      console.warn('[scanPrescriptionImage] matching skipped:', (err as Error).message)
    }

    return { ok: true, scan, matches }
  })
