import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { generateText } from 'ai'

const inputSchema = z.object({
  query: z.string().trim().min(2).max(300),
})

const SYSTEM_PROMPT = `أنت مساعد صيدلية المصلي الذكي (MUSLLY AI).
- أجب باللغة العربية بأسلوب واضح وموجز (3-5 جمل كحدّ أقصى).
- اعتمد فقط على "سياق الكاتالوج" المُعطى في الرسالة إن وُجد.
- إذا كان السؤال طبيًا حسّاسًا (جرعات، تفاعلات دوائية، تشخيص) اطلب صراحةً استشارة الصيدلي أو الطبيب ولا تُقدّم إرشادًا سريريًا مباشرًا.
- لا تخترع منتجات أو أسعار أو مخزون غير مذكور في السياق.
- إذا لم يكن السياق كافيًا قل ذلك بوضوح واقترح التواصل مع الصيدلية.`

export interface CosmicSearchResult {
  answer: string
  matches: Array<{
    id: string
    name_ar: string
    brand: string | null
    barcode: string | null
    strength: string | null
    requires_prescription: boolean
  }>
  latencyMs: number
}

export const cosmicSearch = createServerFn({ method: 'POST' })
  .inputValidator((raw: unknown) => inputSchema.parse(raw))
  .handler(async ({ data }): Promise<CosmicSearchResult> => {
    const t0 = Date.now()
    const apiKey = process.env.LOVABLE_API_KEY
    if (!apiKey) throw new Error('AI غير مُفعّل حاليًا.')

    const { fetchInventoryContext } = await import('./ai/runtime/data-bridge.server')
    const { createLovableAiGatewayProvider } = await import('./ai/gateway.server')

    const { matches, contextText } = await fetchInventoryContext(data.query, 5)

    const gateway = createLovableAiGatewayProvider(apiKey)
    const model = gateway('google/gemini-3-flash-preview')

    const userPrompt = `سياق الكاتالوج (قراءة فقط):\n${contextText}\n\nسؤال المستخدم:\n${data.query}`

    const { recordAiCall } = await import('./ai/observability.server')
    const { classifyThrownAi, aiUserMessage, AiError } = await import('./ai/error-classify')

    let result: Awaited<ReturnType<typeof generateText>>
    try {
      result = await generateText({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        maxOutputTokens: 500,
      })
    } catch (err) {
      const klass = classifyThrownAi(err)
      void recordAiCall({
        feature: 'cosmic-search',
        model: 'google/gemini-3-flash-preview',
        backend: 'gateway',
        ok: false,
        latencyMs: Date.now() - t0,
        errorClass: klass,
      })
      throw new AiError(klass, aiUserMessage(klass), 502, crypto.randomUUID())
    }

    void recordAiCall({
      feature: 'cosmic-search',
      model: 'google/gemini-3-flash-preview',
      backend: 'gateway',
      ok: true,
      latencyMs: Date.now() - t0,
    })

    return {
      answer: result.text.trim(),
      matches: matches.map((m) => ({
        id: m.id,
        name_ar: m.name_ar,
        brand: m.brand,
        barcode: m.barcode,
        strength: m.strength,
        requires_prescription: m.requires_prescription,
      })),
      latencyMs: Date.now() - t0,
    }
  })
