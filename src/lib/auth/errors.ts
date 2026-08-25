/**
 * Arabic-facing auth error messages.
 *
 * Raw provider errors are never shown to patients, and messages never reveal
 * whether an account exists (account-enumeration protection).
 */

export const AUTH_MESSAGES_AR = {
  invalidOtp: 'رمز التحقق غير صحيح.',
  expiredOtp: 'انتهت صلاحية رمز التحقق. يرجى طلب رمز جديد.',
  tooManyAttempts: 'تم تجاوز عدد المحاولات المسموح بها. يرجى المحاولة لاحقًا.',
  network: 'تعذر الاتصال بالخدمة. يرجى التحقق من الاتصال والمحاولة مرة أخرى.',
  timeout: 'استغرقت العملية وقتًا أطول من المتوقع. يرجى المحاولة مرة أخرى.',
  phoneDisabled: 'التحقق عبر رقم الهاتف غير متاح حاليًا. يرجى استخدام البريد الإلكتروني.',
  accountConfirmation: 'الحساب يحتاج إلى تفعيل قبل تسجيل الدخول. تواصل مع إدارة الصيدلية.',
  registrationConfig: 'تعذر إنشاء الحساب برقم الهاتف لأن إعداد التسجيل غير مكتمل. تواصل مع إدارة الصيدلية.',
  invalidCredentials: 'بيانات الدخول غير صحيحة.',
  weakPassword: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.',
  generic: 'تعذر إكمال العملية. يرجى المحاولة مرة أخرى.',
} as const

export type AuthMessageKey = keyof typeof AUTH_MESSAGES_AR

/** Map an unknown provider/network error to a safe Arabic message. */
export function toArabicAuthError(error: unknown): string {
  const raw = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase()
  if (!raw) return AUTH_MESSAGES_AR.generic

  if (raw.includes('rate limit') || raw.includes('too many') || raw.includes('429')) {
    return AUTH_MESSAGES_AR.tooManyAttempts
  }
  if (raw.includes('expired')) return AUTH_MESSAGES_AR.expiredOtp
  if (raw.includes('otp') || raw.includes('token') || raw.includes('code')) {
    return AUTH_MESSAGES_AR.invalidOtp
  }
  if (raw.includes('timeout') || raw.includes('timed out')) return AUTH_MESSAGES_AR.timeout
  if (raw.includes('failed to fetch') || raw.includes('network') || raw.includes('offline')) {
    return AUTH_MESSAGES_AR.network
  }
  if (raw.includes('password') && raw.includes('short')) return AUTH_MESSAGES_AR.weakPassword
  if (raw.includes('invalid login') || raw.includes('invalid credentials')) {
    return AUTH_MESSAGES_AR.invalidCredentials
  }
  if (raw.includes('email not confirmed') || raw.includes('confirmation required')) {
    return AUTH_MESSAGES_AR.accountConfirmation
  }
  if (
    raw.includes('email address is invalid') ||
    raw.includes('invalid email') ||
    raw.includes('signup is disabled') ||
    raw.includes('signups not allowed')
  ) {
    return AUTH_MESSAGES_AR.registrationConfig
  }
  if (raw.includes('phone') && (raw.includes('disabled') || raw.includes('not enabled'))) {
    return AUTH_MESSAGES_AR.phoneDisabled
  }
  if (raw.includes('unsupported provider') || raw.includes('provider is not enabled')) {
    return AUTH_MESSAGES_AR.phoneDisabled
  }
  return AUTH_MESSAGES_AR.generic
}

type AuthDiagnostic = {
  name: string
  code: string | null
  status: number | null
  message: string
}

function redactAuthMessage(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/bearer\s+\S+/gi, 'Bearer [redacted]')
    .slice(0, 300)
}

/** Development-safe diagnostics: no credentials, identifiers, or form data. */
export function getSafeAuthDiagnostic(error: unknown): AuthDiagnostic {
  const value = error as { name?: unknown; code?: unknown; status?: unknown; message?: unknown }
  const message = error instanceof Error ? error.message : String(value?.message ?? error ?? '')
  return {
    name: typeof value?.name === 'string' ? value.name : 'AuthError',
    code: typeof value?.code === 'string' ? value.code : null,
    status: typeof value?.status === 'number' ? value.status : null,
    message: redactAuthMessage(message || 'Unknown authentication error'),
  }
}
