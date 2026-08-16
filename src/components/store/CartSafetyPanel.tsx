import { useQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { ShieldAlert, ShieldCheck, Loader2 } from 'lucide-react'
import { screenCartSafety } from '@/lib/cart-safety.functions'
import { SEVERITY_CLASS, SEVERITY_LABEL } from '@/lib/medical/interaction-engine'

/** Renders the clinical cross-check between the cart and the family profile. */
export function CartSafetyPanel() {
  const screen = useServerFn(screenCartSafety)
  const q = useQuery({
    queryKey: ['cart-safety'],
    queryFn: () => screen({ data: {} }),
    staleTime: 30_000,
  })

  if (q.isLoading) {
    return (
      <div dir="rtl" className="flex items-center gap-2 rounded-2xl border border-white/40 bg-white/70 p-4 text-xs text-muted-foreground dark:bg-slate-900/60">
        <Loader2 className="h-4 w-4 animate-spin" /> جارٍ فحص أمان السلة…
      </div>
    )
  }
  if (q.isError || !q.data) return null

  const { hits, profileName } = q.data

  if (hits.length === 0) {
    return (
      <div dir="rtl" className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs text-emerald-800">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          لم نرصد تعارضات دوائية معروفة في سلتك
          {profileName ? ` مقارنةً بالملف الصحي لـ «${profileName}»` : ''}. راجع الصيدلي عند أي شك.
        </p>
      </div>
    )
  }

  return (
    <section dir="rtl" className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-black text-foreground">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        فحص الأمان الدوائي{profileName ? ` — ${profileName}` : ''}
      </h3>
      <ul className="space-y-2">
        {hits.map((h, i) => (
          <li key={`${h.title}-${i}`} className={`rounded-2xl border p-3 text-xs ${SEVERITY_CLASS[h.severity]}`}>
            <p className="font-black">
              {SEVERITY_LABEL[h.severity]} — {h.title}
            </p>
            <p className="mt-1 leading-relaxed">{h.detail}</p>
            <p className="mt-1 font-bold">التوصية: {h.advice}</p>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">
        هذا فحص إرشادي آلي ولا يُغني عن مراجعة الصيدلي أو الطبيب المعالج.
      </p>
    </section>
  )
}

export default CartSafetyPanel
