// Canonical AI failure classification — shared by EVERY AI call site.
//
// Phase 1 (Stabilize) of the Central AI Core blueprint: one error taxonomy, one
// Arabic user-facing message set, one retry/failover policy. Pure module — no
// secrets, no network, no server-only imports, so raw-fetch call sites and the
// canonical provider can both use it.

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

/** Arabic-first, user-safe message. Never contains provider internals. */
export function aiUserMessage(klass: AiErrorClass): string {
  switch (klass) {
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

/** Map an HTTP status (+ optional provider detail text) to a class. */
export function classifyAiFailure(status: number, detail = ''): AiErrorClass {
  if (/insufficient_quota|credit_balance_exhausted|billing_hard_limit/i.test(detail)) {
    return 'no_credit'
  }
  if (status === 401) return 'unauthorized'
  if (status === 402) return 'no_credit'
  if (status === 403) return 'forbidden'
  if (status === 429) return /quota|credit/i.test(detail) ? 'no_credit' : 'rate_limited'
  if (status >= 500) return 'upstream'
  return 'invalid_request'
}

/** Map a thrown value (SDK error, fetch failure, abort) to a class. */
export function classifyThrownAi(err: unknown): AiErrorClass {
  if (err instanceof AiError) return err.klass
  const e = err as { name?: string; status?: number; statusCode?: number; message?: string }
  if (e?.name === 'AbortError') return 'aborted'
  const status = e?.status ?? e?.statusCode
  const message = e?.message ?? ''
  if (typeof status === 'number' && status > 0) return classifyAiFailure(status, message)
  if (/insufficient_quota|credit_balance_exhausted|billing/i.test(message)) return 'no_credit'
  if (/unauthorized|invalid api key|401/i.test(message)) return 'unauthorized'
  if (/rate.?limit|429/i.test(message)) return 'rate_limited'
  if (/no object generated|schema|json/i.test(message)) return 'malformed'
  if (/fetch failed|network|ECONN|socket|timeout/i.test(message)) return 'network'
  return 'upstream'
}

/** Transient classes only — everything else is terminal and must not be re-sent. */
export function isRetryableAiError(klass: AiErrorClass): boolean {
  return klass === 'rate_limited' || klass === 'upstream' || klass === 'network'
}

/** A backend that can never succeed as configured — try the other one instead. */
export function shouldFailoverAiError(klass: AiErrorClass): boolean {
  return (
    klass === 'no_credit' ||
    klass === 'unauthorized' ||
    klass === 'forbidden' ||
    klass === 'missing_key'
  )
}

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
  get userMessage(): string {
    return aiUserMessage(this.klass)
  }
}
