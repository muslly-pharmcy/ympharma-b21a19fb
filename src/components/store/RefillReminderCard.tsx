import { useState } from 'react'
import { BellRing, Loader2, CheckCircle2 } from 'lucide-react'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import { subscribeRefillReminder } from '@/lib/store-requests.functions'

interface Props {
  productId?: string
  productName?: string
  conditionTag?: string
}

/** One-click monthly refill reminder opt-in for chronic medication. */
export function RefillReminderCard({ productId, productName, conditionTag }: Props) {
  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const subscribe = useServerFn(subscribeRefillReminder)

  const submit = async () => {
    if (!fullName.trim() || !phone.trim()) {
      toast.error('الاسم ورقم الهاتف مطلوبان')
      return
    }
    setBusy(true)
    try {
      await subscribe({
        data: {
          fullName: fullName.trim(),
          phone: phone.trim(),
          productId,
          productName,
          conditionTag,
        },
      })
      setDone(true)
      toast.success('تم تفعيل التذكير الشهري')
    } catch (e) {
      toast.error((e as Error).message || 'تعذّر تفعيل التذكير')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div dir="rtl" className="glass-card rounded-2xl border border-white/40 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <BellRing className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-bold text-foreground">تذكير إعادة التعبئة الشهرية</p>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">
            نُذكّرك قبل نفاد دوائك المزمن ونجهّز الطلب مسبقاً — بدون حساب.
          </p>

          {done ? (
            <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> تم التفعيل — سنتواصل معك شهرياً
            </p>
          ) : open ? (
            <div className="mt-3 space-y-2">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="الاسم"
                aria-label="الاسم"
                className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="رقم الهاتف / واتساب"
                inputMode="tel"
                aria-label="رقم الهاتف"
                className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                onClick={() => void submit()}
                disabled={busy}
                className="press-scale flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} تفعيل التذكير
              </button>
            </div>
          ) : (
            <button
              onClick={() => setOpen(true)}
              className="press-scale mt-3 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700"
            >
              فعّل التذكير الشهري
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
