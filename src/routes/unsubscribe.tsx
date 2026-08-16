import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/unsubscribe')({
  head: () => ({
    meta: [
      { title: 'إلغاء الاشتراك في الرسائل | صيدلية المصلي' },
      { name: 'description', content: 'إلغاء اشتراكك في رسائل البريد الإلكتروني من صيدلية المصلي.' },
      { property: 'og:title', content: 'إلغاء الاشتراك | صيدلية المصلي' },
      { property: 'og:description', content: 'إدارة اشتراكك في رسائل البريد الإلكتروني.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: UnsubscribePage,
})

type State = 'checking' | 'valid' | 'invalid' | 'done' | 'error'

function UnsubscribePage() {
  const [state, setState] = useState<State>('checking')
  const [token, setToken] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token')
    setToken(t)
    if (!t) {
      setState('invalid')
      return
    }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(t)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text())
        setState('valid')
      })
      .catch(() => setState('invalid'))
  }, [])

  const confirm = async () => {
    if (!token) return
    try {
      const r = await fetch('/email/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (!r.ok) throw new Error(await r.text())
      setState('done')
    } catch (e) {
      setMessage((e as Error).message)
      setState('error')
    }
  }

  return (
    <main dir="rtl" className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center p-6">
      <div className="glass-card w-full rounded-3xl border border-border p-8 text-center">
        <h1 className="text-xl font-bold text-foreground">إلغاء الاشتراك</h1>
        {state === 'checking' && <p className="mt-3 text-sm text-muted-foreground">جارٍ التحقق…</p>}
        {state === 'invalid' && (
          <p className="mt-3 text-sm text-muted-foreground">الرابط غير صالح أو تم استخدامه مسبقاً.</p>
        )}
        {state === 'valid' && (
          <>
            <p className="mt-3 text-sm text-muted-foreground">
              اضغط للتأكيد وسنتوقف عن إرسال هذه الرسائل إلى بريدك.
            </p>
            <button
              onClick={confirm}
              className="mt-5 rounded-xl bg-primary px-6 py-2 text-sm font-medium text-primary-foreground"
            >
              تأكيد إلغاء الاشتراك
            </button>
          </>
        )}
        {state === 'done' && <p className="mt-3 text-sm text-emerald-600">تم إلغاء اشتراكك بنجاح.</p>}
        {state === 'error' && <p className="mt-3 text-sm text-destructive">{message || 'حدث خطأ، حاول لاحقاً.'}</p>}
      </div>
    </main>
  )
}
