import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { listCoupons } from '@/lib/promotions.functions'
import { createCoupon, archiveCoupon } from '@/lib/promotions.mutations.functions'

export const Route = createFileRoute('/_authenticated/coupons')({
  component: CouponsPage,
  head: () => ({ meta: [
    { title: 'Coupons — MUSLLY' },
    { name: 'description', content: 'Coupon issuance with single/multi/one-per-customer modes and per-branch scopes.' },
  ] }),
})

function CouponsPage() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['coupons'], queryFn: () => listCoupons() })
  const [showNew, setShowNew] = useState(false)
  const [filter, setFilter] = useState('')
  const archive = useMutation({
    mutationFn: (id: string) => archiveCoupon({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coupons'] }),
  })
  const coupons = (q.data?.coupons ?? []).filter((c) => !filter || c.name.toLowerCase().includes(filter.toLowerCase()))
  type CodeRow = NonNullable<typeof q.data>['codes'][number]
  const codesByCoupon = new Map<string, CodeRow[]>()
  for (const c of (q.data?.codes ?? [])) {
    const arr = codesByCoupon.get(c.coupon_id) ?? []; arr.push(c); codesByCoupon.set(c.coupon_id, arr)
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-6 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">القسائم</h1>
          <p className="text-sm text-slate-400">إصدار وإدارة أكواد الخصم مع حدود الاستخدام</p>
        </div>
        <div className="flex gap-3">
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="بحث" className="rounded-lg bg-slate-900/60 border border-white/10 px-3 py-2 text-sm" />
          <button onClick={() => setShowNew((v) => !v)} className="rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-4 py-2 text-sm hover:bg-emerald-500/30">
            {showNew ? 'إغلاق' : 'قسيمة جديدة'}
          </button>
        </div>
      </header>

      {showNew && <NewCouponForm onDone={() => { setShowNew(false); qc.invalidateQueries({ queryKey: ['coupons'] }) }} />}

      <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {coupons.map((c) => {
          const codes = codesByCoupon.get(c.id) ?? []
          const totalUses = codes.reduce((s, cc) => s + cc.usage_count, 0)
          return (
            <div key={c.id} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{c.name}</h3>
                  <p className="text-xs text-slate-400">{c.mode} · {c.status}</p>
                </div>
                {c.status !== 'archived' && (
                  <button onClick={() => archive.mutate(c.id)} className="text-xs text-red-300 hover:underline">أرشفة</button>
                )}
              </div>
              <div className="text-xs text-slate-400 grid grid-cols-2 gap-2">
                <span>الأكواد: {codes.length}</span>
                <span>الاستخدامات: {totalUses}{c.global_limit ? ` / ${c.global_limit}` : ''}</span>
                <span>لكل عميل: {c.per_customer_limit ?? '∞'}</span>
                <span>الحد الأدنى: {c.min_spend ?? '—'}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {codes.slice(0, 8).map((cc) => (
                  <code key={cc.id} className={`text-xs px-2 py-1 rounded font-mono ${cc.is_active ? 'bg-emerald-500/15 text-emerald-200' : 'bg-slate-700/40 text-slate-400 line-through'}`}>{cc.code}</code>
                ))}
                {codes.length > 8 && <span className="text-xs text-slate-500 self-center">+{codes.length - 8}</span>}
              </div>
            </div>
          )
        })}
        {coupons.length === 0 && (
          <div className="md:col-span-3 rounded-2xl border border-dashed border-white/10 p-12 text-center text-slate-400">
            لا توجد قسائم بعد. أنشئ الأولى من الأعلى.
          </div>
        )}
      </section>
    </div>
  )
}

function NewCouponForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'single'|'multi'|'one_per_customer'>('multi')
  const [codes, setCodes] = useState('')
  const [globalLimit, setGlobalLimit] = useState<string>('')
  const [minSpend, setMinSpend] = useState<string>('')
  const [maxDiscount, setMaxDiscount] = useState<string>('')
  const [expiresAt, setExpiresAt] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: () => createCoupon({ data: {
      name, mode,
      global_limit: globalLimit ? Number(globalLimit) : null,
      min_spend: minSpend ? Number(minSpend) : null,
      max_discount: maxDiscount ? Number(maxDiscount) : null,
      stackable: false,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      codes: codes.split(/[\s,]+/).map((c) => c.trim()).filter(Boolean)
        .map((code) => ({ code, expires_at: expiresAt ? new Date(expiresAt).toISOString() : null })),
      idempotencyKey: `coupon-${crypto.randomUUID()}`,
    } }),
    onSuccess: () => onDone(),
    onError: (e) => setError((e as Error).message),
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); setError(null); create.mutate() }} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 grid md:grid-cols-3 gap-3">
      <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم القسيمة" className="rounded-lg bg-slate-900/60 border border-white/10 px-3 py-2 text-sm" />
      <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="rounded-lg bg-slate-900/60 border border-white/10 px-3 py-2 text-sm">
        <option value="multi">متعدد الاستخدام</option>
        <option value="single">استخدام واحد</option>
        <option value="one_per_customer">مرة واحدة لكل عميل</option>
      </select>
      <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} placeholder="ينتهي" className="rounded-lg bg-slate-900/60 border border-white/10 px-3 py-2 text-sm" />
      <textarea required value={codes} onChange={(e) => setCodes(e.target.value)} placeholder="الأكواد (افصل بمسافة أو فاصلة)" rows={3} className="md:col-span-3 rounded-lg bg-slate-900/60 border border-white/10 px-3 py-2 text-sm font-mono" />
      <input value={globalLimit} onChange={(e) => setGlobalLimit(e.target.value)} placeholder="الحد الإجمالي للاستخدامات" className="rounded-lg bg-slate-900/60 border border-white/10 px-3 py-2 text-sm" />
      <input value={minSpend} onChange={(e) => setMinSpend(e.target.value)} placeholder="الحد الأدنى للإنفاق" className="rounded-lg bg-slate-900/60 border border-white/10 px-3 py-2 text-sm" />
      <input value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} placeholder="الحد الأقصى للخصم" className="rounded-lg bg-slate-900/60 border border-white/10 px-3 py-2 text-sm" />
      <button disabled={create.isPending} className="md:col-span-3 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-4 py-2 text-sm hover:bg-emerald-500/30 disabled:opacity-50">
        {create.isPending ? 'جارٍ الإنشاء...' : 'إنشاء'}
      </button>
      {error && <p className="md:col-span-3 text-red-400 text-xs">{error}</p>}
    </form>
  )
}
