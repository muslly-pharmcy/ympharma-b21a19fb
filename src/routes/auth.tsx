import { createFileRoute, useNavigate, useSearch, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { useEffect, useRef, useState } from 'react'
import { Mail, Smartphone, Loader2, ArrowRight } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { ensurePatientIdentity } from '@/lib/patient-identity.functions'
import {
  NAME_LABELS_AR,
  NAME_ERROR_AR,
  NAME_PART_MAX,
  buildFullName,
  validateThreePartName,
  type ThreePartName,
} from '@/lib/auth/patient-name'
import { DEFAULT_COUNTRY_CODE, looksLikeEmail, normalizePhone } from '@/lib/auth/phone'
import { AUTH_MESSAGES_AR, toArabicAuthError } from '@/lib/auth/errors'

const searchSchema = z.object({
  redirect: z.string().optional(),
  mode: z.enum(['signin', 'signup']).optional(),
})

export const Route = createFileRoute('/auth')({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: 'إنشاء حساب أو تسجيل الدخول — صيدلية المصلي' },
      {
        name: 'description',
        content: 'أنشئ حسابك في صيدلية المصلي بالاسم الثلاثي وطريقة تحقق واحدة: رقم الهاتف أو البريد الإلكتروني.',
      },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: AuthPage,
})

const DEFAULT_REDIRECT = '/patient-profile'
const OTP_LENGTH = 6

// Accept only internal, single-slash paths. Reject:
// - absolute URLs (http:, https:, javascript:, data:, mailto:, tel:, ...)
// - protocol-relative (//host, /\host) that some browsers normalize to hosts
// - control chars, whitespace, or excessive length that could smuggle URLs
// - percent-encoded slashes / backslashes that decode into `//` or `/\`
function safeRedirect(raw?: string): string {
  if (!raw || typeof raw !== 'string') return DEFAULT_REDIRECT
  if (raw.length > 512) return DEFAULT_REDIRECT
  if (/[\s\u0000-\u001f\u007f]/.test(raw)) return DEFAULT_REDIRECT

  let decoded = raw
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    return DEFAULT_REDIRECT
  }

  if (!decoded.startsWith('/')) return DEFAULT_REDIRECT
  if (decoded.startsWith('//') || decoded.startsWith('/\\')) return DEFAULT_REDIRECT
  if (decoded.startsWith('/auth')) return DEFAULT_REDIRECT
  return raw
}

type Step = 'name' | 'method' | 'phone' | 'otp' | 'email'
type Mode = 'signin' | 'signup'

const EMPTY_NAME: ThreePartName = { firstName: '', fatherName: '', familyName: '' }

const inputClass =
  'w-full rounded-xl border border-border bg-background px-4 py-3 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25'

function AuthPage() {
  const search = useSearch({ from: '/auth' })
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { isFlagEnabled } = useFeatureFlags()
  const phoneAuthEnabled = isFlagEnabled('enable_phone_auth')

  const [mode, setMode] = useState<Mode>(search.mode ?? 'signin')
  const [step, setStep] = useState<Step>(search.mode === 'signup' ? 'name' : 'email')

  // Pre-auth name lives in React state only — never persisted before authentication.
  const [name, setName] = useState<ThreePartName>(EMPTY_NAME)
  const [nameErrors, setNameErrors] = useState<Array<keyof ThreePartName>>([])

  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resendIn, setResendIn] = useState(0)
  const submitting = useRef(false)

  const redirectTo = safeRedirect(search.redirect)
  const fullNamePreview = buildFullName(name)

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    void (async () => {
      try {
        await ensurePatientIdentity({ data: name })
      } catch {
        // Identity completion is retried on the profile page; never block sign-in.
      }
      if (!cancelled) {
        setName(EMPTY_NAME)
        void navigate({ to: redirectTo, replace: true })
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  function reset(next: Step) {
    setError(null)
    setInfo(null)
    setStep(next)
  }

  async function guard<T>(fn: () => Promise<T>) {
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      await fn()
    } catch (err) {
      setError(toArabicAuthError(err))
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = validateThreePartName(name)
    setNameErrors(parsed.invalid)
    if (!parsed.ok) {
      setError(NAME_ERROR_AR)
      return
    }
    setName(parsed.value)
    reset('method')
  }

  function sendOtp() {
    if (!phoneAuthEnabled) {
      setError(AUTH_MESSAGES_AR.phoneDisabled)
      return
    }
    const e164 = normalizePhone(phone, DEFAULT_COUNTRY_CODE)
    if (!e164) {
      setError('رقم الهاتف غير صالح. مثال: 7XXXXXXXX')
      return
    }
    void guard(async () => {
      const { error: err } = await supabase.auth.signInWithOtp({
        phone: e164,
        options: {
          shouldCreateUser: true,
          data:
            mode === 'signup'
              ? {
                  first_name: name.firstName,
                  father_name: name.fatherName,
                  family_name: name.familyName,
                }
              : undefined,
        },
      })
      if (err) throw err
      setResendIn(60)
      setOtp('')
      reset('otp')
      setInfo('أرسلنا رمز التحقق إلى رقمك.')
    })
  }

  function verifyOtp(e: React.FormEvent) {
    e.preventDefault()
    const e164 = normalizePhone(phone, DEFAULT_COUNTRY_CODE)
    if (!e164) {
      setError('رقم الهاتف غير صالح. مثال: 7XXXXXXXX')
      return
    }
    void guard(async () => {
      const { error: err } = await supabase.auth.verifyOtp({
        phone: e164,
        token: otp.trim(),
        type: 'sms',
      })
      if (err) throw err
      setInfo('تم التحقق بنجاح')
    })
  }

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsedEmail = z.string().trim().email().safeParse(email)
    if (!parsedEmail.success) {
      setError('البريد الإلكتروني غير صالح')
      return
    }
    if (password.length < 8) {
      setError(AUTH_MESSAGES_AR.weakPassword)
      return
    }
    void guard(async () => {
      if (mode === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: parsedEmail.data,
          password,
        })
        if (err) throw err
      } else {
        const { error: err } = await supabase.auth.signUp({
          email: parsedEmail.data,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${redirectTo}`,
            data: {
              first_name: name.firstName,
              father_name: name.fatherName,
              family_name: name.familyName,
            },
          },
        })
        if (err) throw err
        setInfo('تم إنشاء حسابك. تحقّق من بريدك لتأكيد التسجيل.')
      }
    })
  }

  function handleForgot() {
    const parsedEmail = z.string().trim().email().safeParse(email)
    if (!parsedEmail.success) {
      setError('أدخل البريد الإلكتروني أولًا')
      return
    }
    void guard(async () => {
      const { error: err } = await supabase.auth.resetPasswordForEmail(parsedEmail.data, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (err) throw err
      // Generic wording: never confirms whether the account exists.
      setInfo('إذا كان هذا البريد مسجلًا لدينا فستصلك رسالة لاستعادة كلمة المرور.')
    })
  }

  function switchMode(next: Mode) {
    setMode(next)
    setNameErrors([])
    reset(next === 'signup' ? 'name' : 'email')
  }

  return (
    <main dir="rtl" className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <header className="text-center">
        <h1 className="text-2xl font-bold text-foreground">صيدلية المصلي</h1>
        <p className="mt-1 text-lg text-foreground">أهلاً بك 👋</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === 'signup' ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}
        </p>
      </header>

      <section className="glass-panel rounded-2xl p-5 sm:p-6">
        {mode === 'signup' && step === 'name' && (
          <form onSubmit={handleNameSubmit} className="space-y-4" noValidate>
            <p className="text-center text-base font-medium text-foreground">أدخل اسمك الثلاثي</p>
            {(Object.keys(NAME_LABELS_AR) as Array<keyof ThreePartName>).map((key) => (
              <label key={key} className="block">
                <span className="mb-1 block text-sm font-medium text-foreground">
                  {NAME_LABELS_AR[key]}
                </span>
                <input
                  type="text"
                  autoComplete={key === 'firstName' ? 'given-name' : 'off'}
                  maxLength={NAME_PART_MAX}
                  value={name[key]}
                  onChange={(e) => setName((n) => ({ ...n, [key]: e.target.value }))}
                  aria-invalid={nameErrors.includes(key)}
                  aria-describedby={nameErrors.includes(key) ? 'name-error' : undefined}
                  className={`${inputClass} ${nameErrors.includes(key) ? 'border-destructive' : ''}`}
                />
              </label>
            ))}

            {fullNamePreview && (
              <p className="rounded-xl bg-muted px-4 py-3 text-sm text-foreground">
                الاسم الكامل: <span className="font-semibold">{fullNamePreview}</span>
              </p>
            )}

            <SubmitButton busy={busy} label="متابعة" />
          </form>
        )}

        {mode === 'signup' && step === 'method' && (
          <div className="space-y-3">
            <p className="text-center text-base font-medium text-foreground">اختر طريقة التحقق</p>
            <button
              type="button"
              onClick={() => (phoneAuthEnabled ? reset('phone') : setError(AUTH_MESSAGES_AR.phoneDisabled))}
              aria-disabled={!phoneAuthEnabled}
              className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-base font-medium transition ${
                phoneAuthEnabled
                  ? 'border-primary/40 text-foreground hover:bg-primary/5'
                  : 'border-border text-muted-foreground'
              }`}
            >
              <Smartphone className="h-5 w-5" aria-hidden /> رقم الهاتف
            </button>
            {!phoneAuthEnabled && (
              <p className="text-center text-xs text-muted-foreground">
                {AUTH_MESSAGES_AR.phoneDisabled}
              </p>
            )}
            <button
              type="button"
              onClick={() => reset('email')}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-primary/40 px-4 py-3 text-base font-medium text-foreground transition hover:bg-primary/5"
            >
              <Mail className="h-5 w-5" aria-hidden /> البريد الإلكتروني
            </button>
            <BackButton onClick={() => reset('name')} label="تعديل الاسم" />
          </div>
        )}

        {step === 'phone' && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              sendOtp()
            }}
            className="space-y-4"
            noValidate
          >
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">رقم الهاتف</span>
              <div className="flex items-center gap-2" dir="ltr">
                <span className="rounded-xl border border-border bg-muted px-3 py-3 text-sm">
                  +{DEFAULT_COUNTRY_CODE}
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="7XXXXXXXX"
                  className={inputClass}
                />
              </div>
            </label>
            <SubmitButton busy={busy} label="إرسال رمز التحقق" />
            <BackButton onClick={() => reset(mode === 'signup' ? 'method' : 'email')} label="رجوع" />
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={verifyOtp} className="space-y-4" noValidate>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">أدخل رمز التحقق</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={OTP_LENGTH + 2}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                dir="ltr"
                className={`${inputClass} text-center text-2xl tracking-[0.5em]`}
              />
            </label>
            <SubmitButton busy={busy} label="تأكيد" />
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                disabled={resendIn > 0 || busy}
                onClick={sendOtp}
                className="text-primary disabled:text-muted-foreground"
              >
                {resendIn > 0 ? `إعادة إرسال الرمز (${resendIn})` : 'إعادة إرسال الرمز'}
              </button>
              <button type="button" onClick={() => reset('phone')} className="text-muted-foreground">
                تغيير رقم الهاتف
              </button>
            </div>
          </form>
        )}

        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">
                {mode === 'signin' ? 'رقم الهاتف أو البريد الإلكتروني' : 'البريد الإلكتروني'}
              </span>
              <input
                type={mode === 'signin' ? 'text' : 'email'}
                autoComplete={mode === 'signin' ? 'username' : 'email'}
                value={email}
                onChange={(e) => {
                  const v = e.target.value
                  setEmail(v)
                  if (mode === 'signin' && !looksLikeEmail(v) && /\d{6,}/.test(v) && phoneAuthEnabled) {
                    setPhone(v)
                  }
                }}
                placeholder={mode === 'signin' ? 'example@email.com' : 'example@email.com'}
                dir="ltr"
                className={inputClass}
              />
            </label>

            {mode === 'signin' && !looksLikeEmail(email) && /\d{6,}/.test(email) && (
              <button
                type="button"
                onClick={() => (phoneAuthEnabled ? reset('phone') : setError(AUTH_MESSAGES_AR.phoneDisabled))}
                className="w-full rounded-xl border border-primary/40 px-4 py-3 text-sm font-medium text-foreground"
              >
                المتابعة برقم الهاتف
              </button>
            )}

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">كلمة المرور</span>
              <input
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                dir="ltr"
                className={inputClass}
              />
            </label>

            <SubmitButton busy={busy} label={mode === 'signin' ? 'متابعة' : 'إنشاء الحساب'} />

            {mode === 'signin' && (
              <button
                type="button"
                onClick={handleForgot}
                className="w-full text-sm text-muted-foreground hover:underline"
              >
                نسيت كلمة المرور؟
              </button>
            )}
            {mode === 'signup' && <BackButton onClick={() => reset('method')} label="رجوع" />}
          </form>
        )}

        <div aria-live="polite" className="mt-4 space-y-2">
          {error && (
            <p id="name-error" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}
          {info && (
            <p className="rounded-xl bg-primary/10 px-4 py-3 text-sm text-primary">{info}</p>
          )}
        </div>
      </section>

      <div className="text-center text-sm">
        <button
          type="button"
          onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
          className="font-medium text-primary hover:underline"
        >
          {mode === 'signin' ? 'إنشاء حساب جديد' : 'لديّ حساب — تسجيل الدخول'}
        </button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        <Link to="/" className="hover:underline">
          العودة للصفحة الرئيسية
        </Link>
      </p>
    </main>
  )
}

function SubmitButton({ busy, label }: { busy: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-base font-semibold text-primary-foreground transition disabled:opacity-50"
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {label}
    </button>
  )
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1 text-sm text-muted-foreground hover:underline"
    >
      <ArrowRight className="h-4 w-4" aria-hidden />
      {label}
    </button>
  )
}
