import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { listPromotions } from '@/lib/promotions.functions'
import { transitionPromotion, createPromotion } from '@/lib/promotions.mutations.functions'
import type { PromotionStatus } from '@/domain/promotions/schemas'

export const Route = createFileRoute('/_authenticated/promotions/')({
  component: PromotionsPage,
  head: () => ({ meta: [
    { title: 'Promotions — MUSLLY' },
    { name: 'description', content: 'Enterprise promotion engine — percentage, fixed, BOGO, free shipping, tier discounts.' },
  ] }),
})

const STATUS_STYLE: Record<PromotionStatus, string> = {
  draft: 'bg-slate-500/20 text-slate-300',
  active: 'bg-emerald-500/20 text-emerald-300',
  paused: 'bg-amber-500/20 text-amber-300',
  archived: 'bg-slate-700/40 text-slate-400',
  expired: 'bg-red-500/20 text-red-300',
}

function PromotionsPage() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['promotions'], queryFn: () => listPromotions() })
  const [showNew, setShowNew] = useState(false)
  const transition = useMutation({
    mutationFn: (v: { id: string; next: PromotionStatus }) => transitionPromotion({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promotions'] }),
  })

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">العروض والترويج</h1>
          <p className="text-sm text-slate-400">محرك عروض موحد يخدم الحملات، المبيعات، والولاء</p>
        </div>
        <button onClick={() => setShowNew((v) => !v)} className="rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-4 py-2 text-sm hover:bg-emerald-500/30">
          {showNew ? 'إغلاق' : 'عرض جديد'}
        </button>
      </header>

      {showNew && <NewPromotionForm onDone={() => { setShowNew(false); qc.invalidateQueries({ queryKey: ['promotions'] }) }} />}

      <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-slate-300">
            <tr>
              <th className="text-right px-4 py-3">الكود</th>
              <th className="text-right px-4 py-3">الاسم</th>
              <th className="text-right px-4 py-3">النوع</th>
              <th className="text-right px-4 py-3">الحالة</th>
              <th className="text-right px-4 py-3">الأولوية</th>
              <th className="text-right px-4 py-3">مكدس</th>
              <th className="text-right px-4 py-3">الاستخدام</th>
              <th className="text-right px-4 py-3">النافذة</th>
              <th className="text-right px-4 py-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((p) => (
              <tr key={p.id} className="border-t border-white/5">
                <td className="px-4 py-3 font-mono text-xs text-slate-400">
                  <Link to="/promotions/$id" params={{ id: p.id }} className="hover:text-emerald-300">{p.code}</Link>
                </td>
                <td className="px-4 py-3">{p.name}</td>
                <td className="px-4 py-3 text-slate-400">{p.kind}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded ${STATUS_STYLE[p.status]}`}>{p.status}</span>
                </td>
                <td className="px-4 py-3">{p.priority}</td>
                <td className="px-4 py-3">{p.stackable ? '✓' : '—'}</td>
                <td className="px-4 py-3">{p.usage_count}{p.usage_limit ? ` / ${p.usage_limit}` : ''}</td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {p.starts_at ? new Date(p.starts_at).toLocaleDateString('ar-EG') : '—'}
                  {' → '}
                  {p.expires_at ? new Date(p.expires_at).toLocaleDateString('ar-EG') : '∞'}
                </td>
                <td className="px-4 py-3 space-x-2 space-x-reverse">
                  {p.status === 'draft' && (
                    <button onClick={() => transition.mutate({ id: p.id, next: 'active' })} className="text-xs text-emerald-300 hover:underline">تفعيل</button>
                  )}
                  {p.status === 'active' && (
                    <button onClick={() => transition.mutate({ id: p.id, next: 'paused' })} className="text-xs text-amber-300 hover:underline">إيقاف</button>
                  )}
                  {p.status === 'paused' && (
                    <button onClick={() => transition.mutate({ id: p.id, next: 'active' })} className="text-xs text-emerald-300 hover:underline">استئناف</button>
                  )}
                  {p.status !== 'archived' && (
                    <button onClick={() => transition.mutate({ id: p.id, next: 'archived' })} className="text-xs text-red-300 hover:underline">أرشفة</button>
                  )}
                </td>
              </tr>
            ))}
            {q.data && q.data.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">لا توجد عروض بعد</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function NewPromotionForm({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'percentage'|'fixed'|'bogo'|'free_shipping'|'category_discount'|'tier_discount'|'free_gift'>('percentage')
  const [amount, setAmount] = useState(10)
  const [priority, setPriority] = useState(100)
  const [stackable, setStackable] = useState(false)
  const [minSpend, setMinSpend] = useState<string>('')
  const [maxDiscount, setMaxDiscount] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: () => createPromotion({ data: {
      code: code.toUpperCase(), name, kind,
      config: kind === 'fixed' ? { amount } :
              kind === 'free_shipping' ? { shipping_cost: amount } :
              kind === 'free_gift' ? { gift_product: 'placeholder' } :
              kind === 'category_discount' ? { percent: amount, category: 'general' } :
              kind === 'tier_discount' ? { percent: amount, tier: 'gold' } :
              kind === 'bogo' ? { buy: 1, get: 1, discount_percent: 100 } :
              { percent: amount },
      priority, stackable,
      min_spend: minSpend ? Number(minSpend) : null,
      max_discount: maxDiscount ? Number(maxDiscount) : null,
      targets: [], eligibility: [],
      idempotencyKey: `promo-${crypto.randomUUID()}`,
    } }),
    onSuccess: () => onDone(),
    onError: (e) => setError((e as Error).message),
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); setError(null); create.mutate() }} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 grid md:grid-cols-3 gap-3">
      <input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="الكود (مثال: SUMMER10)" className="rounded-lg bg-slate-900/60 border border-white/10 px-3 py-2 text-sm" />
      <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم العرض" className="rounded-lg bg-slate-900/60 border border-white/10 px-3 py-2 text-sm" />
      <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="rounded-lg bg-slate-900/60 border border-white/10 px-3 py-2 text-sm">
        <option value="percentage">نسبة مئوية</option>
        <option value="fixed">مبلغ ثابت</option>
        <option value="bogo">اشترِ X واحصل على Y</option>
        <option value="free_shipping">شحن مجاني</option>
        <option value="free_gift">هدية مجانية</option>
        <option value="category_discount">خصم فئة</option>
        <option value="tier_discount">خصم مستوى ولاء</option>
      </select>
      <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} placeholder="القيمة/النسبة" className="rounded-lg bg-slate-900/60 border border-white/10 px-3 py-2 text-sm" />
      <input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} placeholder="الأولوية (الأقل يُطبّق أولاً)" className="rounded-lg bg-slate-900/60 border border-white/10 px-3 py-2 text-sm" />
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={stackable} onChange={(e) => setStackable(e.target.checked)} />
        قابل للتكديس
      </label>
      <input value={minSpend} onChange={(e) => setMinSpend(e.target.value)} placeholder="الحد الأدنى للإنفاق" className="rounded-lg bg-slate-900/60 border border-white/10 px-3 py-2 text-sm" />
      <input value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} placeholder="الحد الأقصى للخصم" className="rounded-lg bg-slate-900/60 border border-white/10 px-3 py-2 text-sm" />
      <button disabled={create.isPending} className="rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-4 py-2 text-sm hover:bg-emerald-500/30 disabled:opacity-50">
        {create.isPending ? 'جارٍ الإنشاء...' : 'إنشاء'}
      </button>
      {error && <p className="md:col-span-3 text-red-400 text-xs">{error}</p>}
    </form>
  )
}
