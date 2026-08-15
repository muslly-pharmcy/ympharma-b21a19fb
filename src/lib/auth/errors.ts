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
  if (raw.includes('phone') && (raw.includes('disabled') || raw.includes('not enabled'))) {
    return AUTH_MESSAGES_AR.phoneDisabled
  }
  if (raw.includes('unsupported provider') || raw.includes('provider is not enabled')) {
    return AUTH_MESSAGES_AR.phoneDisabled
  }
  return AUTH_MESSAGES_AR.generic
}
