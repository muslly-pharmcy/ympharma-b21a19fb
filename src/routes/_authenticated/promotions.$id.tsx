import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getPromotion } from '@/lib/promotions.functions'

export const Route = createFileRoute('/_authenticated/promotions/$id')({
  component: PromotionDetail,
  head: () => ({ meta: [{ title: 'تفاصيل العرض — MUSLLY' }] }),
  errorComponent: ({ error }) => <div className="p-6 text-red-400">{(error as Error).message}</div>,
  notFoundComponent: () => <div className="p-6">غير موجود</div>,
})

function PromotionDetail() {
  const { id } = Route.useParams()
  const q = useQuery({ queryKey: ['promotion', id], queryFn: () => getPromotion({ data: { id } }) })
  if (q.isLoading) return <div className="p-6 text-slate-400">جارٍ التحميل...</div>
  if (!q.data) return <div className="p-6 text-slate-400">غير موجود</div>
  const { promotion: p, targets, eligibility, redemptions } = q.data
  const totalDiscount = redemptions.reduce((s, r) => s + Number(r.discount_amount || 0), 0)

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-6 space-y-6">
      <Link to="/promotions" className="text-sm text-slate-400 hover:text-slate-200">← جميع العروض</Link>
      <header>
        <h1 className="text-3xl font-bold">{p.name}</h1>
        <p className="text-sm text-slate-400 font-mono">{p.code} · {p.kind} · {p.status}</p>
      </header>

      <section className="grid md:grid-cols-4 gap-3">
        {[
          { label: 'الاستخدام', value: `${p.usage_count}${p.usage_limit ? ` / ${p.usage_limit}` : ''}` },
          { label: 'الأولوية', value: p.priority },
          { label: 'الحد الأدنى', value: p.min_spend ?? '—' },
          { label: 'الحد الأقصى للخصم', value: p.max_discount ?? '—' },
          { label: 'إجمالي المخصوم', value: totalDiscount.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' }) },
          { label: 'قابل للتكديس', value: p.stackable ? 'نعم' : 'لا' },
          { label: 'يبدأ', value: p.starts_at ? new Date(p.starts_at).toLocaleString('ar-EG') : '—' },
          { label: 'ينتهي', value: p.expires_at ? new Date(p.expires_at).toLocaleString('ar-EG') : '∞' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
            <div className="text-xs text-slate-400">{s.label}</div>
            <div className="text-lg font-semibold">{s.value}</div>
          </div>
        ))}
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
          <h2 className="font-semibold mb-3">الإعدادات (JSON)</h2>
          <pre className="text-xs bg-black/40 rounded p-3 overflow-auto max-h-64">{JSON.stringify(p.config, null, 2)}</pre>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
          <h2 className="font-semibold mb-3">الأهداف ({targets.length})</h2>
          <ul className="text-xs space-y-1">
            {targets.map((t) => (
              <li key={t.id} className="text-slate-300">
                <span className={t.target_kind === 'exclude' ? 'text-red-300' : 'text-emerald-300'}>{t.target_kind}</span>
                {' · '}{t.entity_kind} = <span className="font-mono">{t.entity_ref}</span>
              </li>
            ))}
            {targets.length === 0 && <li className="text-slate-500">لا توجد قيود (يطبق على كل السلة)</li>}
          </ul>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
          <h2 className="font-semibold mb-3">شروط الأهلية ({eligibility.length})</h2>
          <ul className="text-xs space-y-1">
            {eligibility.map((e) => (
              <li key={e.id} className="text-slate-300">
                <span className="text-cyan-300">{e.kind}</span>
                {e.value && <> · <span className="font-mono">{e.value}</span></>}
              </li>
            ))}
            {eligibility.length === 0 && <li className="text-slate-500">متاح للجميع</li>}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden">
        <h2 className="font-semibold px-4 py-3 border-b border-white/10">آخر الاسترداد ({redemptions.length})</h2>
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-slate-300">
            <tr>
              <th className="text-right px-4 py-2">العميل</th>
              <th className="text-right px-4 py-2">مرجع الطلب</th>
              <th className="text-right px-4 py-2">الخصم</th>
              <th className="text-right px-4 py-2">الوقت</th>
            </tr>
          </thead>
          <tbody>
            {redemptions.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="px-4 py-2 font-mono text-xs text-slate-400">{r.customer_id?.slice(0, 8) ?? '—'}</td>
                <td className="px-4 py-2">{r.order_ref ?? '—'}</td>
                <td className="px-4 py-2 text-emerald-300">{Number(r.discount_amount).toLocaleString('ar-EG')}</td>
                <td className="px-4 py-2 text-slate-400">{new Date(r.redeemed_at).toLocaleString('ar-EG')}</td>
              </tr>
            ))}
            {redemptions.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">لا يوجد استرداد بعد</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
