import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { listRewards } from '@/lib/loyalty.functions'
import { createReward } from '@/lib/loyalty.mutations.functions'

export const Route = createFileRoute('/_authenticated/rewards')({
  component: RewardsPage,
  head: () => ({ meta: [{ title: 'الجوائز — MUSLLY' }] }),
  errorComponent: ({ error }) => <div className="p-6 text-red-500">فشل التحميل: {(error as Error).message}</div>,
  notFoundComponent: () => <div className="p-6">غير موجود</div>,
})

function RewardsPage() {
  const q = useQuery({ queryKey: ['rewards'], queryFn: () => listRewards({ data: {} }) })
  const create = useServerFn(createReward)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', points_cost: '', description: '' })
  const mut = useMutation({
    mutationFn: () => create({ data: {
      code: form.code.trim(), name: form.name.trim(),
      points_cost: Number(form.points_cost),
      description: form.description.trim() || null,
    } }),
    onSuccess: () => { setShowNew(false); setForm({ code: '', name: '', points_cost: '', description: '' }); q.refetch() },
  })

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">🎁 كتالوج الجوائز</h1>
          <p className="text-sm text-slate-400">Reward Catalog</p>
        </div>
        <button onClick={() => setShowNew((v) => !v)} className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2">
          {showNew ? 'إلغاء' : '+ جائزة'}
        </button>
      </header>

      {showNew && (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 space-y-3">
          <div className="grid md:grid-cols-4 gap-3">
            <input placeholder="الكود *" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2" />
            <input placeholder="الاسم *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2" />
            <input type="number" min={1} placeholder="النقاط المطلوبة *" value={form.points_cost} onChange={(e) => setForm({ ...form, points_cost: e.target.value })} className="rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2" />
            <input placeholder="الوصف" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2" />
          </div>
          {mut.isError && <div className="text-red-300 text-sm">{(mut.error as Error).message}</div>}
          <button disabled={!form.code || !form.name || !form.points_cost || mut.isPending} onClick={() => mut.mutate()} className="rounded-lg bg-emerald-500 disabled:opacity-40 text-slate-950 font-semibold px-4 py-2">
            {mut.isPending ? 'جارٍ الحفظ...' : 'حفظ'}
          </button>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {(q.data ?? []).map((r) => (
          <div key={r.id} className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 ${!r.is_active ? 'opacity-50' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-emerald-300">{r.code}</span>
              <span className="text-xs text-slate-400">{r.stock !== null ? `المخزون: ${r.stock}` : 'غير محدود'}</span>
            </div>
            <h3 className="font-semibold mt-2">{r.name}</h3>
            {r.description && <p className="text-xs text-slate-400 mt-1">{r.description}</p>}
            <div className="mt-3 text-2xl font-bold text-emerald-300">{r.points_cost.toLocaleString('ar-EG')} <span className="text-xs text-slate-400">نقطة</span></div>
          </div>
        ))}
        {q.isSuccess && (q.data ?? []).length === 0 && (
          <div className="md:col-span-3 rounded-2xl border border-dashed border-white/10 p-6 text-center text-slate-400">لا توجد جوائز بعد</div>
        )}
      </div>
    </div>
  )
}
