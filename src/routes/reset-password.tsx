import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/reset-password')({
  head: () => ({
    meta: [{ title: 'إعادة تعيين كلمة المرور — MUSLLY AI OS' }],
  }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Supabase drops `type=recovery` into the URL hash after the email link is clicked
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (hash.includes('type=recovery') || hash.includes('access_token')) {
      setReady(true)
    } else {
      setError('رابط استعادة كلمة المرور غير صالح أو منتهي.')
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setInfo(null)
    if (password.length < 8) return setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setInfo('تم تحديث كلمة المرور. جاري التحويل...')
      setTimeout(() => navigate({ to: '/auth', replace: true }), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل التحديث')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-center text-2xl font-bold">إعادة تعيين كلمة المرور</h1>
      <form onSubmit={handleSubmit} className="glass-panel space-y-4 rounded-2xl p-6">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">كلمة المرور الجديدة</span>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!ready}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 pl-12 text-sm disabled:opacity-50"
              dir="ltr"
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              disabled={!ready}
              aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              aria-pressed={showPassword}
              className="absolute inset-y-0 left-1 flex w-10 items-center justify-center text-gray-500 disabled:opacity-40"
            >
              {showPassword ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
            </button>
          </div>
        </label>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {info && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{info}</p>}
        <button
          type="submit"
          disabled={busy || !ready}
          className="w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-white disabled:opacity-50"
        >
          {busy ? '...' : 'حفظ كلمة المرور'}
        </button>
      </form>
    </div>
  )
}
