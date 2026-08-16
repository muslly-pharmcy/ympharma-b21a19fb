import { createFileRoute, useNavigate, useSearch, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { useEffect, useRef, useState } from 'react'
import { Loader2, Camera, Upload, X } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { ensurePatientIdentity } from '@/lib/patient-identity.functions'
import {
  NAME_LABELS_AR,
  NAME_ERROR_AR,
  NAME_PART_MAX,
  buildFullName,
  validateThreePartName,
  type ThreePartName,
} from '@/lib/auth/patient-name'
import { DEFAULT_COUNTRY_CODE, looksLikeEmail, normalizePhone, phoneToAuthEmail } from '@/lib/auth/phone'
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
        content: 'أنشئ حسابك في صيدلية المصلي بالاسم الثلاثي ورقم الهاتف، ودخول فوري بدون رموز تحقق.',
      },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: AuthPage,
})

const DEFAULT_REDIRECT = '/patient-profile'
const MAX_CARD_BYTES = 8 * 1024 * 1024
const CARD_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']

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

type Mode = 'signin' | 'signup'

const EMPTY_NAME: ThreePartName = { firstName: '', fatherName: '', familyName: '' }

const inputClass =
  'w-full rounded-xl border border-border bg-background px-4 py-3 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25'

function AuthPage() {
  const search = useSearch({ from: '/auth' })
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const [mode, setMode] = useState<Mode>(search.mode ?? 'signin')

  // Pre-auth data lives in React state only — nothing is persisted before authentication.
  const [name, setName] = useState<ThreePartName>(EMPTY_NAME)
  const [nameErrors, setNameErrors] = useState<Array<keyof ThreePartName>>([])
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [card, setCard] = useState<File | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const cameraRef = useRef<HTMLInputElement | null>(null)

  const redirectTo = safeRedirect(search.redirect)
  const fullNamePreview = buildFullName(name)

  // Once a session exists: upload the optional card, map the patient record, go in.
  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    void (async () => {
      let insuranceCardPath: string | null = null
      try {
        if (card) {
          const { data: userData } = await supabase.auth.getUser()
          const uid = userData.user?.id
          if (uid) {
            const ext = card.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
            const path = `${uid}/insurance-${Date.now()}.${ext}`
            const { error: upErr } = await supabase.storage
              .from('insurance-cards')
              .upload(path, card, { upsert: false, contentType: card.type || undefined })
            if (!upErr) insuranceCardPath = path
          }
        }
      } catch {
        // The card is optional — never block sign-in on an upload failure.
      }
      try {
        await ensurePatientIdentity({ data: { ...name, phone: phone || null, insuranceCardPath } })
      } catch {
        // Identity completion is retried on the profile page; never block sign-in.
      }
      if (!cancelled) {
        setName(EMPTY_NAME)
        setCard(null)
        void navigate({ to: redirectTo, replace: true })
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

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

  function pickCard(file: File | undefined) {
    if (!file) return
    if (file.size > MAX_CARD_BYTES) {
      setError('حجم الملف كبير جدًا. الحد الأقصى 8 ميغابايت.')
      return
    }
    if (file.type && !CARD_TYPES.includes(file.type)) {
      setError('صيغة الملف غير مدعومة. استخدم صورة أو ملف PDF.')
      return
    }
    setError(null)
    setCard(file)
  }

  function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    const parsed = validateThreePartName(name)
    setNameErrors(parsed.invalid)
    if (!parsed.ok) {
      setError(NAME_ERROR_AR)
      return
    }
    setName(parsed.value)

    const authEmail = phoneToAuthEmail(phone, DEFAULT_COUNTRY_CODE)
    const e164 = normalizePhone(phone, DEFAULT_COUNTRY_CODE)
    if (!authEmail || !e164) {
      setError('رقم الهاتف غير صالح. مثال: 7XXXXXXXX')
      return
    }
    if (password.length < 8) {
      setError(AUTH_MESSAGES_AR.weakPassword)
      return
    }

    void guard(async () => {
      const { error: err } = await supabase.auth.signUp({
        email: authEmail,
        password,
        options: {
          data: {
            first_name: parsed.value.firstName,
            father_name: parsed.value.fatherName,
            family_name: parsed.value.familyName,
            phone: e164,
          },
        },
      })
      if (err) throw err
      setInfo('تم إنشاء حسابك، جارٍ الدخول...')
      // The session arrives through onAuthStateChange; the effect above finishes setup.
    })
  }

  function handleSignin(e: React.FormEvent) {
    e.preventDefault()
    const raw = identifier.trim()
    const loginEmail = looksLikeEmail(raw)
      ? z.string().trim().email().safeParse(raw).data ?? null
      : phoneToAuthEmail(raw, DEFAULT_COUNTRY_CODE)

    if (!loginEmail) {
      setError('أدخل رقم هاتف صحيح أو بريدًا إلكترونيًا صحيحًا.')
      return
    }
    if (password.length < 8) {
      setError(AUTH_MESSAGES_AR.weakPassword)
      return
    }
    void guard(async () => {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      })
      if (err) throw err
    })
  }

  function handleForgot() {
    const raw = identifier.trim()
    if (!looksLikeEmail(raw)) {
      setError('استعادة كلمة المرور متاحة للحسابات المسجلة ببريد إلكتروني. لحسابات الهاتف تواصل مع الصيدلية.')
      return
    }
    const parsedEmail = z.string().trim().email().safeParse(raw)
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
    setError(null)
    setInfo(null)
    setPassword('')
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
        {mode === 'signup' ? (
          <form onSubmit={handleSignup} className="space-y-4" noValidate>
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
                  aria-describedby={nameErrors.includes(key) ? 'auth-error' : undefined}
                  className={`${inputClass} ${nameErrors.includes(key) ? 'border-destructive' : ''}`}
                />
              </label>
            ))}

            {fullNamePreview && (
              <p className="rounded-xl bg-muted px-4 py-3 text-sm text-foreground">
                الاسم الكامل: <span className="font-semibold">{fullNamePreview}</span>
              </p>
            )}

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">📱 رقم الهاتف</span>
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
                  placeholder="77XXXXXXX"
                  className={inputClass}
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">كلمة المرور</span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                dir="ltr"
                className={inputClass}
              />
              <span className="mt-1 block text-xs text-muted-foreground">8 أحرف على الأقل</span>
            </label>

            <div className="rounded-xl border border-dashed border-border p-3">
              <p className="mb-2 text-sm font-medium text-foreground">
                💳 صورة البطاقة التأمينية <span className="text-muted-foreground">(اختياري)</span>
              </p>
              {card ? (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
                  <span className="truncate">{card.name}</span>
                  <button
                    type="button"
                    onClick={() => setCard(null)}
                    aria-label="إزالة الملف"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => cameraRef.current?.click()}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-primary/40 px-3 py-2 text-sm text-foreground"
                  >
                    <Camera className="h-4 w-4" aria-hidden /> التقاط
                  </button>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-primary/40 px-3 py-2 text-sm text-foreground"
                  >
                    <Upload className="h-4 w-4" aria-hidden /> رفع صورة
                  </button>
                </div>
              )}
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => pickCard(e.target.files?.[0])}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                hidden
                onChange={(e) => pickCard(e.target.files?.[0])}
              />
            </div>

            <SubmitButton busy={busy} label="🚀 إنشاء الحساب والدخول" />
          </form>
        ) : (
          <form onSubmit={handleSignin} className="space-y-4" noValidate>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">
                رقم الهاتف أو البريد الإلكتروني
              </span>
              <input
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="77XXXXXXX"
                dir="ltr"
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">كلمة المرور</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                dir="ltr"
                className={inputClass}
              />
            </label>

            <SubmitButton busy={busy} label="تسجيل الدخول" />

            <button
              type="button"
              onClick={handleForgot}
              className="w-full text-sm text-muted-foreground hover:underline"
            >
              نسيت كلمة المرور؟
            </button>
          </form>
        )}

        <div aria-live="polite" className="mt-4 space-y-2">
          {error && (
            <p id="auth-error" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}
          {info && <p className="rounded-xl bg-primary/10 px-4 py-3 text-sm text-primary">{info}</p>}
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
