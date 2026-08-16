// Error classification — maps arbitrary thrown values into a stable taxonomy
// used for UI copy, recovery actions, and telemetry.

export type ErrorKind =
  | 'network'      // fetch failed, offline, DNS, timeout
  | 'auth'         // 401, missing session, expired token
  | 'permission'   // 403, RLS denied
  | 'notfound'     // 404
  | 'validation'   // 400, Zod/schema failures
  | 'conflict'     // 409, idempotency conflicts
  | 'rate_limit'   // 429
  | 'server'       // 5xx, database error
  | 'chunk'        // dynamic import / stale bundle
  | 'unknown'

export interface ClassifiedError {
  kind: ErrorKind
  status?: number
  message: string
  userMessageAr: string
  recoverable: boolean
  retryable: boolean
  original: unknown
}

const AR_COPY: Record<ErrorKind, string> = {
  network: 'يبدو أن الاتصال بالإنترنت غير مستقر. تحقّق من اتصالك ثم أعد المحاولة.',
  auth: 'انتهت الجلسة أو لم يتم تسجيل الدخول. الرجاء تسجيل الدخول من جديد.',
  permission: 'لا تملك الصلاحية اللازمة لعرض هذا المحتوى.',
  notfound: 'العنصر المطلوب غير موجود أو تم نقله.',
  validation: 'البيانات المُدخلة غير صالحة. الرجاء مراجعتها والمحاولة مجددًا.',
  conflict: 'حدث تعارض أثناء حفظ التغييرات. حاول مرة أخرى بعد تحديث الصفحة.',
  rate_limit: 'تم تجاوز الحد المسموح من الطلبات. انتظر لحظات ثم أعد المحاولة.',
  server: 'حدث خلل مؤقت في الخادم. نعمل على معالجته — أعد المحاولة بعد قليل.',
  chunk: 'تم تحديث التطبيق. أعد تحميل الصفحة للحصول على أحدث نسخة.',
  unknown: 'حدث خطأ غير متوقع. أعد المحاولة أو عد إلى الصفحة الرئيسية.',
}

function extractStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined
  const e = err as Record<string, unknown>
  if (typeof e.status === 'number') return e.status
  if (typeof e.statusCode === 'number') return e.statusCode
  const resp = e.response as { status?: number } | undefined
  if (resp && typeof resp.status === 'number') return resp.status
  // Supabase PostgrestError style
  if (typeof e.code === 'string') {
    if (e.code === 'PGRST301' || e.code === '42501') return 403
    if (e.code === 'PGRST116') return 404
  }
  return undefined
}

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (err && typeof err === 'object') {
    const m = (err as { message?: unknown }).message
    if (typeof m === 'string') return m
  }
  return 'Unknown error'
}

export function classifyError(err: unknown): ClassifiedError {
  const status = extractStatus(err)
  const message = extractMessage(err)
  const lower = message.toLowerCase()

  let kind: ErrorKind = 'unknown'

  if (
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('offline') ||
    lower.includes('load failed') ||
    lower.includes('networkerror')
  ) {
    kind = 'network'
  } else if (
    lower.includes('loading chunk') ||
    lower.includes('dynamically imported module') ||
    lower.includes('failed to fetch dynamically imported')
  ) {
    kind = 'chunk'
  } else if (status === 401 || lower.includes('unauthorized') || lower.includes('jwt') || lower.includes('no authorization')) {
    kind = 'auth'
  } else if (status === 403 || lower.includes('forbidden') || lower.includes('row-level security') || lower.includes('permission denied')) {
    kind = 'permission'
  } else if (status === 404 || lower.includes('not found')) {
    kind = 'notfound'
  } else if (status === 409 || lower.includes('conflict') || lower.includes('duplicate key')) {
    kind = 'conflict'
  } else if (status === 429 || lower.includes('rate limit') || lower.includes('too many requests')) {
    kind = 'rate_limit'
  } else if (status === 400 || lower.includes('validation') || lower.includes('invalid input') || lower.includes('zod')) {
    kind = 'validation'
  } else if ((status && status >= 500) || lower.includes('internal server') || lower.includes('database error')) {
    kind = 'server'
  }

  const retryable = kind === 'network' || kind === 'server' || kind === 'rate_limit' || kind === 'unknown'
  const recoverable = kind !== 'permission' && kind !== 'notfound'

  return {
    kind,
    status,
    message,
    userMessageAr: AR_COPY[kind],
    recoverable,
    retryable,
    original: err,
  }
}
