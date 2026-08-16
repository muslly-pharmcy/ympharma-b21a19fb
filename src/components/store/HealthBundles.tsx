import { useState } from 'react'
import { motion } from 'framer-motion'
import { PackageCheck, Loader2, CheckCircle2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import { listHealthBundles, orderHealthBundle } from '@/lib/store-requests.functions'

type Bundle = {
  id: string
  slug: string
  title_ar: string
  description_ar: string | null
  bundle_price: number | null
  discount_label: string | null
  items: Array<{ id: string; label_ar: string; quantity: number }>
}

/** Curated health bundles with a lightweight order form. */
export function HealthBundles() {
  const bundlesFn = useServerFn(listHealthBundles)
  const orderFn = useServerFn(orderHealthBundle)
  const [openId, setOpenId] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [doneId, setDoneId] = useState<string | null>(null)

  const { data } = useQuery({
    queryKey: ['storefront', 'bundles'],
    queryFn: () => bundlesFn(),
    staleTime: 10 * 60_000,
  })

  const bundles = (data ?? []) as unknown as Bundle[]
  if (!bundles.length) return null

  const submit = async (b: Bundle) => {
    if (!fullName.trim() || !phone.trim()) {
      toast.error('الاسم ورقم الهاتف مطلوبان')
      return
    }
    setBusy(true)
    try {
      await orderFn({
        data: { bundleId: b.id, bundleTitle: b.title_ar, fullName: fullName.trim(), phone: phone.trim() },
      })
      setDoneId(b.id)
      setOpenId(null)
      setFullName('')
      setPhone('')
      toast.success('تم استلام طلب الباقة — سنتواصل معك قريباً')
    } catch (e) {
      toast.error((e as Error).message || 'تعذّر إرسال الطلب')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="px-4 pb-8 sm:px-6 lg:px-8" id="bundles">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-3 text-lg font-bold text-foreground">باقات صحية بأسعار مخفّضة</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bundles.map((b, i) => (
            <motion.article
              key={b.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: Math.min(i, 4) * 0.05 }}
              className="glass-card flex flex-col gap-3 rounded-3xl border border-white/40 p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <PackageCheck className="h-5 w-5" />
                </span>
                {b.discount_label && (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                    {b.discount_label}
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">{b.title_ar}</h3>
                {b.description_ar && (
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">{b.description_ar}</p>
                )}
              </div>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {b.items.map((it) => (
                  <li key={it.id}>• {it.label_ar}</li>
                ))}
              </ul>
              <p className="text-sm font-black text-primary">
                {b.bundle_price ? `${Number(b.bundle_price).toLocaleString('ar-EG')} ر.ي` : 'اسأل عن السعر'}
              </p>

              {doneId === b.id ? (
                <p className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> تم استلام طلبك
                </p>
              ) : openId === b.id ? (
                <div className="space-y-2">
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
                    placeholder="رقم الهاتف"
                    inputMode="tel"
                    aria-label="رقم الهاتف"
                    className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  <button
                    onClick={() => void submit(b)}
                    disabled={busy}
                    className="press-scale flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />} تأكيد الطلب
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setOpenId(b.id)}
                  className="press-scale mt-auto rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-bold text-primary"
                >
                  اطلب الباقة
                </button>
              )}
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}
