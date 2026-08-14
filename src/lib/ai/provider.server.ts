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
      case 'no_credit':
        return 'خدمة الذكاء غير متاحة مؤقتاً. تم إبلاغ الفريق التقني.'
      case 'aborted':
        return 'تم إيقاف الطلب.'
      default:
        return 'تعذر إكمال الطلب الآن. حاول مرة أخرى أو تواصل مع الصيدلية.'
    }
  }
}

function classify(status: number, detail = ''): AiErrorClass {
  if (/insufficient_quota|credit_balance_exhausted|billing_hard_limit/i.test(detail)) return 'no_credit'
  if (status === 401) return 'unauthorized'
  if (status === 402) return 'no_credit'
  if (status === 403) return 'forbidden'
  if (status === 429) return /quota|credit/i.test(detail) ? 'no_credit' : 'rate_limited'
  if (status >= 500) return 'upstream'
  return 'invalid_request'
}

function isRetryable(klass: AiErrorClass): boolean {
  return klass === 'rate_limited' || klass === 'upstream' || klass === 'network'
}

/** A backend that can never succeed as configured — try the other one instead. */
function shouldFailover(klass: AiErrorClass): boolean {
  return klass === 'no_credit' || klass === 'unauthorized' || klass === 'forbidden' || klass === 'missing_key'
}

interface BackendConfig {
  url: string
  headers: Record<string, string>
  model: string
}

function resolveBackend(
  backend: AiBackend,
  model: string,
  correlationId: string,
): BackendConfig {
  const bare = model.replace(/^openai\//, '')
  if (backend === 'openai') {
    const key = process.env['OPENAI_API_KEY']
    if (!key) throw new AiError('missing_key', 'OPENAI_API_KEY is not configured', 500, correlationId)
    return {
      url: OPENAI_RESPONSES_URL,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      model: bare,
    }
  }
  const key = process.env['LOVABLE_API_KEY']
  if (!key) throw new AiError('missing_key', 'managed gateway key is not configured', 500, correlationId)
  return {
    url: GATEWAY_RESPONSES_URL,
    headers: {
      'Content-Type': 'application/json',
      'Lovable-API-Key': key,
      'X-Lovable-AIG-SDK': 'fetch',
    },
    model: `openai/${bare}`,
  }
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
  /** Preferred backend; the other is used automatically as failover. */
  backend?: AiBackend
}

export interface AiCallResult {
  text: string
  /** Raw `output[]` items, needed to round-trip tool calls and reasoning. */
  output: AiInputItem[]
  functionCalls: Array<{ callId: string; name: string; args: string }>
  /** Which backend actually served the call. */
  backend: AiBackend
  model: string
  latencyMs: number
  usage: { input: number; output: number; total: number }
}

interface StreamAccumulator {
  text: string
  completed?: Record<string, unknown>
  /** Stream-level failure: the HTTP status is 200 but the run failed mid-stream. */
  streamError?: { code: string; message: string }
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
            const evt = JSON.parse(payload) as {
              type?: string
              delta?: string
              response?: Record<string, unknown>
              error?: { code?: string; type?: string; message?: string }
            }
            if (evt.type === 'response.output_text.delta' && typeof evt.delta === 'string') {
              acc.text += evt.delta
            } else if (evt.type === 'response.completed' && evt.response) {
              acc.completed = evt.response
            } else if (evt.type === 'error' || evt.type === 'response.failed') {
              const err = evt.error ?? (evt.response?.['error'] as Record<string, string> | undefined)
              acc.streamError = {
                code: String(err?.['code'] ?? err?.['type'] ?? 'stream_error'),
                message: String(err?.['message'] ?? 'stream failed'),
              }
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
 * Tries the preferred backend, then automatically fails over to the other one
 * when the first is unusable (no credit / bad key). Never throws a raw provider
 * error — always an AiError.
 */
export async function callOpenAi(opts: AiCallOptions): Promise<AiCallResult> {
  const order: AiBackend[] =
    opts.backend === 'gateway' ? ['gateway', 'openai'] : ['openai', 'gateway']

  let lastError: AiError | null = null
  for (const backend of order) {
    try {
      return await callBackend(backend, opts)
    } catch (e) {
      const err = e as AiError
      if (err.klass === 'aborted') throw err
      lastError = err
      if (!shouldFailover(err.klass)) throw err
      // Fall through to the next backend — same request shape, different provider.
    }
  }
  throw lastError ?? new AiError('upstream', 'AI call failed', 502, opts.correlationId)
}

async function callBackend(backend: AiBackend, opts: AiCallOptions): Promise<AiCallResult> {
  const cfg = resolveBackend(backend, opts.model, opts.correlationId)
  const maxRetries = opts.maxRetries ?? 2
  const started = Date.now()

  const body: Record<string, unknown> = {
    model: cfg.model,
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
      res = await fetch(cfg.url, {
        method: 'POST',
        headers: cfg.headers,
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
      // Body may contain the request echo — read it but never surface it verbatim.
      let detail = ''
      try {
        detail = (await res.text()).slice(0, 400)
      } catch {
        /* ignore */
      }
      const klass = classify(res.status, detail)
      lastError = new AiError(klass, `${backend} ${res.status}`, res.status, opts.correlationId)
      if (isRetryable(klass) && attempt < maxRetries) {
        await sleep(backoffMs(attempt))
        continue
      }
      throw lastError
    }

    const acc = await consumeSse(res, opts.signal)
    if (acc.streamError && !acc.text) {
      const klass = classify(200, `${acc.streamError.code} ${acc.streamError.message}`)
      lastError = new AiError(
        klass === 'invalid_request' ? 'upstream' : klass,
        `${backend} stream: ${acc.streamError.code}`,
        502,
        opts.correlationId,
      )
      if (isRetryable(lastError.klass) && attempt < maxRetries) {
        await sleep(backoffMs(attempt))
        continue
      }
      throw lastError
    }

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
      backend,
      model: String(completed['model'] ?? cfg.model),
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
