import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

export const SOCIAL_PLATFORMS = ['tiktok', 'instagram', 'facebook', 'x'] as const
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]

export interface SocialPost {
  platform: SocialPlatform
  caption: string
  hashtags: string[]
  cta: string
}

const postSchema = z.object({
  posts: z.array(
    z.object({
      platform: z.enum(SOCIAL_PLATFORMS),
      caption: z.string().min(10).max(1200),
      hashtags: z.array(z.string().min(2).max(40)).max(12),
      cta: z.string().min(3).max(200),
    }),
  ),
})

const input = z.object({
  topic: z.string().max(300).optional().nullable(),
  platforms: z.array(z.enum(SOCIAL_PLATFORMS)).min(1).max(4),
  tone: z.enum(['professional', 'friendly', 'urgent']).default('friendly'),
})

export interface GenerateSocialResult {
  ok: boolean
  posts: SocialPost[]
  error?: string
}

/**
 * Generates Arabic social posts grounded in the pharmacy's live catalogue.
 * Admin/staff only — reads a small, non-PII product sample.
 */
export const generateSocialPosts = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => input.parse(raw))
  .handler(async ({ data, context }): Promise<GenerateSocialResult> => {
    try {
      const { data: products } = await context.supabase
        .from('catalog_products')
        .select('name_ar, brand, strength, sbdma_official_price')
        .eq('status', 'approved')
        .eq('is_public', true)
        .order('updated_at', { ascending: false })
        .limit(12)

      const catalogue = (products ?? [])
        .map(
          (p) =>
            `- ${(p as { name_ar: string }).name_ar}${
              (p as { strength: string | null }).strength
                ? ` ${(p as { strength: string | null }).strength}`
                : ''
            }`,
        )
        .join('\n')

      const apiKey = process.env['LOVABLE_API_KEY']
      if (!apiKey) return { ok: false, posts: [], error: 'خدمة الذكاء غير مهيأة' }

      const { createLovableAiGatewayProvider } = await import('./ai/gateway.server')
      const { generateText, Output } = await import('ai')
      const gateway = createLovableAiGatewayProvider(apiKey)

      const startedAt = Date.now()
      const { output } = await generateText({
        model: gateway('google/gemini-3-flash-preview'),
        output: Output.object({ schema: postSchema }),
        maxOutputTokens: 1800,
        system:
          'أنت مسؤول تسويق رقمي لصيدلية "المصلي" في اليمن. اكتب منشورات عربية فصيحة ومختصرة، ' +
          'بدون ادعاءات علاجية طبية مبالغ فيها، وبدون ذكر أسعار غير مؤكدة. ' +
          'اضبط الأسلوب حسب كل منصة: تيك توك قصير وجذاب، إنستغرام بصري، فيسبوك تفصيلي، إكس مختصر جدًا.',
        prompt: [
          `المنصات المطلوبة: ${data.platforms.join(', ')}`,
          `النبرة: ${data.tone}`,
          data.topic ? `الموضوع: ${data.topic}` : 'الموضوع: منتجات وعروض جديدة',
          'عيّنة من المخزون الحالي:',
          catalogue || '- (لا توجد بيانات منتجات)',
          'أنشئ منشورًا واحدًا لكل منصة مطلوبة.',
        ].join('\n'),
      })

      const { recordAiCall } = await import('./ai/observability.server')
      void recordAiCall({
        feature: 'social-posts',
        model: 'google/gemini-3-flash-preview',
        backend: 'gateway',
        ok: true,
        latencyMs: Date.now() - startedAt,
      })
      return { ok: true, posts: (output as z.infer<typeof postSchema>).posts }
    } catch (err) {
      const { classifyThrownAi, aiUserMessage } = await import('./ai/error-classify')
      const klass = classifyThrownAi(err)
      const { recordAiCall } = await import('./ai/observability.server')
      void recordAiCall({
        feature: 'social-posts',
        model: 'google/gemini-3-flash-preview',
        backend: 'gateway',
        ok: false,
        errorClass: klass,
      })
      console.error('[generateSocialPosts]', klass)
      return { ok: false, posts: [], error: aiUserMessage(klass) }
    }
  })
