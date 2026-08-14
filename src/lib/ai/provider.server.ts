// YmPharma Intelligence Layer — the ONE canonical server-side OpenAI gateway.
//
// Every AI call in the application goes through this module. No component,
// hook or route may call an AI provider directly.
//
// Security contract:
// - OPENAI_API_KEY is read inside functions (never at module scope, never VITE_*).
// - The key is never returned, logged, or included in an error message.
// - Errors are mapped to safe application-level classes before leaving the module.
//
// Transport contract:
// - Always streams on the wire (`stream: true`) even when the caller only wants
//   the final text. Buffered reasoning calls get severed by the platform at ~2min,
//   are billed anyway, and get silently re-sent.
// - Bounded retries (429 / 5xx / network only), exponential backoff, no infinite loops.

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
const GATEWAY_RESPONSES_URL = 'https://ai.gateway.lovable.dev/v1/responses'

/**
 * Two interchangeable backends for the SAME OpenAI Responses API:
 * - 'openai'  → the project's own OPENAI_API_KEY (direct billing)
 * - 'gateway' → the managed AI gateway (same models, prefixed ids)
 * One architecture, one request shape. The gateway is the automatic failover
 * when the direct account is unauthorized or out of credit.
 */
export type AiBackend = 'openai' | 'gateway'

export type AiErrorClass =
  | 'missing_key'
  | 'unauthorized'
  | 'forbidden'
  | 'rate_limited'
  | 'invalid_request'
  | 'upstream'
  | 'network'
  | 'aborted'
  | 'no_credit'
  | 'malformed'


export class AiError extends Error {
  readonly klass: AiErrorClass
  readonly status: number
  readonly correlationId: string
  constructor(klass: AiErrorClass, message: string, status: number, correlationId: string) {
    super(message)
    this.name = 'AiError'
    this.klass = klass
    this.status = status
    this.correlationId = correlationId
  }
  /** Arabic-first, user-safe message. Never contains provider internals. */
  get userMessage(): string {
    switch (this.klass) {
      case 'rate_limited':
        return 'الخدمة مزدحمة حالياً. أعد المحاولة بعد لحظات.'
      case 'missing_key':
      case 'unauthorized':
      case 'forbidden':
        return 'خدمة الذكاء غير متاحة مؤقتاً. تم إبلاغ الفريق التقني.'
      case 'aborted':
        return 'تم إيقاف الطلب.'
      default:
        return 'تعذر إكمال الطلب الآن. حاول مرة أخرى أو تواصل مع الصيدلية.'
    }
  }
}

function classify(status: number): AiErrorClass {
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'upstream'
  return 'invalid_request'
}

function isRetryable(klass: AiErrorClass): boolean {
  return klass === 'rate_limited' || klass === 'upstream' || klass === 'network'
}

function readKey(correlationId: string): string {
  const key = process.env['OPENAI_API_KEY']
  if (!key) throw new AiError('missing_key', 'OPENAI_API_KEY is not configured', 500, correlationId)
  return key
}

/** Strict JSON-schema tool definition, Responses-API shape. */
export interface AiToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
  strict?: boolean
}

export type AiInputItem = Record<string, unknown>

export interface AiCallOptions {
  model: string
  /** Responses-API `input[]`, already built by the caller. */
  input: AiInputItem[]
  instructions?: string
  tools?: AiToolDef[]
  /** Reasoning is opt-in; omit for fast/cheap paths. */
  reasoning?: { effort: 'low' | 'medium' | 'high'; summary?: 'auto' | 'concise' | 'detailed' }
  text?: Record<string, unknown>
  maxOutputTokens?: number
  /** Cancel only on an explicit user action — never on a timer. */
  signal?: AbortSignal
  correlationId: string
  maxRetries?: number
}

export interface AiCallResult {
  text: string
  /** Raw `output[]` items, needed to round-trip tool calls and reasoning. */
  output: AiInputItem[]
  functionCalls: Array<{ callId: string; name: string; args: string }>
  model: string
  latencyMs: number
  usage: { input: number; output: number; total: number }
}

interface StreamAccumulator {
  text: string
  completed?: Record<string, unknown>
}

async function consumeSse(res: Response, signal?: AbortSignal): Promise<StreamAccumulator> {
  const acc: StreamAccumulator = { text: '' }
  const reader = res.body?.getReader()
  if (!reader) return acc
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      if (signal?.aborted) break
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let idx: number
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const chunk = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 2)
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim()
          if (!payload || payload === '[DONE]') continue
          try {
            const evt = JSON.parse(payload) as { type?: string; delta?: string; response?: Record<string, unknown> }
            if (evt.type === 'response.output_text.delta' && typeof evt.delta === 'string') {
              acc.text += evt.delta
            } else if (evt.type === 'response.completed' && evt.response) {
              acc.completed = evt.response
            }
          } catch {
            /* ignore partial/unknown frames */
          }
        }
      }
    }
  } finally {
    try {
      await reader.cancel()
    } catch {
      /* stream already closed */
    }
  }
  return acc
}

/**
 * Single canonical AI call. Streams on the wire, returns the completed result.
 * Never throws a raw provider error — always an AiError.
 */
export async function callOpenAi(opts: AiCallOptions): Promise<AiCallResult> {
  const key = readKey(opts.correlationId)
  const maxRetries = opts.maxRetries ?? 2
  const started = Date.now()

  const body: Record<string, unknown> = {
    model: opts.model,
    input: opts.input,
    stream: true,
    store: false,
  }
  if (opts.instructions) body['instructions'] = opts.instructions
  if (opts.tools?.length) {
    body['tools'] = opts.tools.map((t) => ({
      type: 'function',
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      strict: t.strict ?? true,
    }))
  }
  if (opts.reasoning) {
    body['reasoning'] = { effort: opts.reasoning.effort, summary: opts.reasoning.summary ?? 'auto' }
    body['include'] = ['reasoning.encrypted_content']
  }
  if (opts.text) body['text'] = opts.text
  if (opts.maxOutputTokens) body['max_output_tokens'] = opts.maxOutputTokens

  let lastError: AiError | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (opts.signal?.aborted) throw new AiError('aborted', 'aborted by caller', 499, opts.correlationId)
    let res: Response
    try {
      res = await fetch(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
        signal: opts.signal,
      })
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        throw new AiError('aborted', 'aborted by caller', 499, opts.correlationId)
      }
      lastError = new AiError('network', 'network failure reaching AI provider', 502, opts.correlationId)
      if (attempt < maxRetries) {
        await sleep(backoffMs(attempt))
        continue
      }
      throw lastError
    }

    if (!res.ok) {
      const klass = classify(res.status)
      // Body may contain the request echo — read it but never surface it verbatim.
      let detail = ''
      try {
        detail = (await res.text()).slice(0, 400)
      } catch {
        /* ignore */
      }
      lastError = new AiError(klass, `openai ${res.status}: ${detail}`, res.status, opts.correlationId)
      if (isRetryable(klass) && attempt < maxRetries) {
        await sleep(backoffMs(attempt))
        continue
      }
      throw lastError
    }

    const acc = await consumeSse(res, opts.signal)
    const completed = acc.completed ?? {}
    const output = Array.isArray(completed['output']) ? (completed['output'] as AiInputItem[]) : []
    const usageRaw = (completed['usage'] ?? {}) as Record<string, number>
    const functionCalls = output
      .filter((i) => i['type'] === 'function_call')
      .map((i) => ({
        callId: String(i['call_id'] ?? ''),
        name: String(i['name'] ?? ''),
        args: String(i['arguments'] ?? '{}'),
      }))

    let text = acc.text
    if (!text && typeof completed['output_text'] === 'string') text = completed['output_text'] as string

    return {
      text,
      output,
      functionCalls,
      model: String(completed['model'] ?? opts.model),
      latencyMs: Date.now() - started,
      usage: {
        input: usageRaw['input_tokens'] ?? 0,
        output: usageRaw['output_tokens'] ?? 0,
        total: usageRaw['total_tokens'] ?? 0,
      },
    }
  }

  throw lastError ?? new AiError('upstream', 'AI call failed', 502, opts.correlationId)
}

function backoffMs(attempt: number): number {
  return Math.min(4000, 400 * 2 ** attempt) + Math.floor(Math.random() * 250)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Server-side connectivity probe. Returns status only — never the key. */
export async function verifyOpenAiConnection(correlationId = 'probe'): Promise<{
  ok: boolean
  model?: string
  latencyMs?: number
  errorClass?: AiErrorClass
}> {
  try {
    const r = await callOpenAi({
      model: 'gpt-5.6-luna',
      input: [{ role: 'user', content: [{ type: 'input_text', text: 'reply with: ok' }] }],
      correlationId,
      maxRetries: 0,
      maxOutputTokens: 16,
    })
    return { ok: true, model: r.model, latencyMs: r.latencyMs }
  } catch (e) {
    const err = e as AiError
    return { ok: false, errorClass: err.klass ?? 'upstream' }
  }
}
