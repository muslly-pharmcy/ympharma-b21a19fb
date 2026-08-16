// Public patient AI endpoint — YmPharma Intelligence Layer.
//
// This route no longer talks to a model directly. It:
//   1. rate-limits per IP hash
//   2. resolves an OPTIONAL verified user id from the bearer token (never from the prompt)
//   3. runs the canonical OpenAI provider with a versioned prompt + patient tools
//   4. executes tools under application-enforced authorization
//   5. records telemetry (no message content)
//
// Response contract is unchanged (`{ reply }`) so existing clients keep working.

import { createFileRoute } from '@tanstack/react-router'
import { AiError, callOpenAi, type AiInputItem } from '@/lib/ai/provider.server'
import { modelFor, fallbackFor, type AiTask } from '@/lib/ai/model-policy'
import { PATIENT_ASSISTANT_V1, PATIENT_ASSISTANT_VERSION } from '@/lib/ai/prompts/patient-assistant.v1'
import { PATIENT_TOOLS, executePatientTool } from '@/lib/ai/tools/patient-tools.server'
import { recordModuleRun } from '@/lib/ai/runtime/telemetry.server'

type Msg = { role: 'user' | 'assistant' | 'system'; content: string }

const MAX_TURNS = 10
const MAX_CHARS = 2000
const MAX_TOOL_ROUNDS = 3

/* ------------------------------- rate limiting ------------------------------ */

const buckets = new Map<string, number[]>()
const WINDOW_MS = 60_000
const LIMIT_ANON = 12
const LIMIT_AUTH = 30

async function ipHash(request: Request): Promise<string> {
  const raw =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  return Array.from(new Uint8Array(digest).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function allow(key: string, limit: number): boolean {
  const now = Date.now()
  const list = (buckets.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  if (list.length >= limit) {
    buckets.set(key, list)
    return false
  }
  list.push(now)
  buckets.set(key, list)
  return true
}

/* ----------------------------------- auth ----------------------------------- */

/** Optional auth: a valid token grants patient-scoped tools; no token = public scope. */
async function resolveUserId(request: Request): Promise<string | null> {
  const raw = request.headers.get('authorization') ?? ''
  if (!raw.toLowerCase().startsWith('bearer ')) return null
  const token = raw.slice(7).trim()
  if (!token || token.split('.').length !== 3) return null
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !data?.user) return null
    return data.user.id
  } catch {
    return null
  }
}

/* --------------------------------- routing ---------------------------------- */

const CLINICAL_HINTS = [
  'تفاعل',
  'جرعة',
  'حامل',
  'رضاعة',
  'ضغط',
  'سكري',
  'قلب',
  'كلى',
  'كبد',
  'interaction',
  'dose',
  'dosage',
  'pregnan',
]

function pickTask(lastUserText: string): AiTask {
  const t = lastUserText.toLowerCase()
  if (CLINICAL_HINTS.some((h) => t.includes(h))) return 'clinical'
  if (t.length < 40) return 'assist'
  return 'assist'
}

/* ---------------------------------- handler --------------------------------- */

function toInputItems(messages: Msg[]): AiInputItem[] {
  return messages.map((m) => ({
    role: m.role === 'system' ? 'user' : m.role,
    content: [
      {
        type: m.role === 'assistant' ? 'output_text' : 'input_text',
        text: m.content.slice(0, MAX_CHARS),
      },
    ],
  }))
}

export const Route = createFileRoute('/api/chat-widget')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const correlationId = crypto.randomUUID()
        const started = Date.now()

        let body: { messages?: Msg[] }
        try {
          body = (await request.json()) as { messages?: Msg[] }
        } catch {
          return Response.json({ error: 'invalid_json' }, { status: 400 })
        }

        const userId = await resolveUserId(request)
        const bucketKey = userId ? `u:${userId}` : `ip:${await ipHash(request)}`
        if (!allow(bucketKey, userId ? LIMIT_AUTH : LIMIT_ANON)) {
          return Response.json(
            { error: 'rate_limited', reply: 'عدد الطلبات كبير. انتظر دقيقة ثم أعد المحاولة.' },
            { status: 429, headers: { 'retry-after': '60' } },
          )
        }

        const raw = Array.isArray(body.messages) ? body.messages : []
        const messages = raw
          .filter((m) => m && typeof m.content === 'string' && m.content.trim().length > 0)
          .slice(-MAX_TURNS)
        if (messages.length === 0) {
          return Response.json({ error: 'empty_conversation' }, { status: 400 })
        }

        const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''
        const task = pickTask(lastUser)
        let policy = modelFor(task)

        const input: AiInputItem[] = toInputItems(messages)
        const toolNames: string[] = []

        try {
          let result = await runWithTools()
          if (!result.text.trim()) {
            // Empty completion — degrade to the cheap tier once rather than returning blank.
            policy = fallbackFor(task)
            result = await runWithTools()
          }

          void recordModuleRun({
            moduleKey: 'kernel',
            ok: true,
            latencyMs: Date.now() - started,
            meta: {
              surface: 'chat-widget',
              prompt: PATIENT_ASSISTANT_VERSION,
              model: result.model,
              task,
              tools: toolNames,
              tokens: result.usage.total,
              authed: Boolean(userId),
              correlationId,
            },
          })

          return Response.json({
            reply:
              result.text.trim() ||
              'لم أتمكن من صياغة رد الآن. تواصل مع الصيدلية على +967 782 878 280.',
            correlationId,
          })

          async function runWithTools() {
            let last = await callOpenAi({
              feature: 'patient-chat',
              model: policy.model,
              input,
              instructions: PATIENT_ASSISTANT_V1,
              tools: PATIENT_TOOLS,
              reasoning: policy.reasoning,
              maxOutputTokens: policy.maxOutputTokens,
              correlationId,
              signal: request.signal,
            })

            for (let round = 0; round < MAX_TOOL_ROUNDS && last.functionCalls.length > 0; round++) {
              // Round-trip: resend the model's own items, then append tool outputs.
              input.push(...last.output)
              for (const call of last.functionCalls) {
                const exec = await executePatientTool(call.name, call.args, {
                  userId,
                  correlationId,
                })
                toolNames.push(`${call.name}:${exec.ok ? 'ok' : 'fail'}`)
                input.push({
                  type: 'function_call_output',
                  call_id: call.callId,
                  output: JSON.stringify(exec.result).slice(0, 6000),
                })
              }
              last = await callOpenAi({
                feature: 'patient-chat',
                model: policy.model,
                input,
                instructions: PATIENT_ASSISTANT_V1,
                tools: PATIENT_TOOLS,
                reasoning: policy.reasoning,
                maxOutputTokens: policy.maxOutputTokens,
                correlationId,
                signal: request.signal,
              })
            }
            return last
          }
        } catch (e) {
          const err = e as AiError
          const klass = err.klass ?? 'upstream'
          if (klass === 'aborted') return new Response(null, { status: 499 })

          // Structured log — never the key, never the conversation content.
          console.error('[chat-widget]', { correlationId, klass, status: err.status ?? 500 })
          void recordModuleRun({
            moduleKey: 'kernel',
            ok: false,
            latencyMs: Date.now() - started,
            meta: { surface: 'chat-widget', errorClass: klass, task, correlationId },
          })

          return Response.json(
            {
              error: klass,
              reply: err.userMessage ?? 'تعذر إكمال الطلب الآن.',
              correlationId,
            },
            { status: klass === 'rate_limited' ? 429 : 503 },
          )
        }
      },
    },
  },
})
