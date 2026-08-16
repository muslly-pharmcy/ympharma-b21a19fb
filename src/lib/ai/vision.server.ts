// Shared Gemini vision helper — used by prescription OCR, invoice OCR,
// and any other image-to-structured-JSON flow. Routes through the Lovable
// AI Gateway (no direct Google keys). Handler-local imports only.
import { generateText, NoObjectGeneratedError, Output } from 'ai'
import { z } from 'zod'
import { createLovableAiGatewayProvider } from './gateway.server'
import { classifyThrownAi } from './error-classify'
import { recordAiCall } from './observability.server'

export interface VisionCallInput<TSchema extends z.ZodTypeAny> {
  systemPrompt: string
  userPrompt: string
  imageUrl: string // https:// URL (signed URL) or data:image/...;base64,...
  schema: TSchema
  // 'flash' is fine for most receipts/prescriptions; caller may bump if needed.
  model?: string
  maxOutputTokens?: number
  /** Observability label, e.g. 'vision-rx' or 'vision-invoice'. */
  feature?: string
}

export interface VisionCallResult<T> {
  data: T | null
  rawText: string
  usedFallback: boolean
  model: string
}

/**
 * Call Gemini via Lovable Gateway with an image + text prompt and coerce
 * the response into `schema`. Falls back to parsing `error.text` on schema
 * failures instead of throwing.
 */
export async function callVision<TSchema extends z.ZodTypeAny>(
  input: VisionCallInput<TSchema>,
): Promise<VisionCallResult<z.infer<TSchema>>> {
  const apiKey = process.env.LOVABLE_API_KEY
  if (!apiKey) throw new Error('LOVABLE_API_KEY missing on server')

  const modelId = input.model ?? 'google/gemini-3-flash-preview'
  const gateway = createLovableAiGatewayProvider(apiKey)
  const model = gateway(modelId)
  const startedAt = Date.now()
  const feature = input.feature ?? 'vision'

  try {
    const result = await generateText({
      model,
      output: Output.object({ schema: input.schema }),
      maxOutputTokens: input.maxOutputTokens ?? 1400,
      messages: [
        { role: 'system', content: input.systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: input.userPrompt },
            { type: 'image', image: new URL(input.imageUrl) },
          ],
        },
      ],
    })
    void recordAiCall({
      feature,
      model: modelId,
      backend: 'gateway',
      ok: true,
      latencyMs: Date.now() - startedAt,
    })
    return {
      data: result.output as z.infer<TSchema>,
      rawText: result.text,
      usedFallback: false,
      model: modelId,
    }
  } catch (err) {
    void recordAiCall({
      feature,
      model: modelId,
      backend: 'gateway',
      ok: false,
      latencyMs: Date.now() - startedAt,
      errorClass: classifyThrownAi(err),
    })
    if (NoObjectGeneratedError.isInstance(err)) {
      // Attempt lenient JSON parse from the raw model text.
      const text = err.text ?? ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const parsed = input.schema.safeParse(JSON.parse(jsonMatch[0]))
          if (parsed.success) {
            return { data: parsed.data, rawText: text, usedFallback: true, model: modelId }
          }
        } catch {
          // fall through
        }
      }
      return { data: null, rawText: text, usedFallback: true, model: modelId }
    }
    throw err
  }
}
