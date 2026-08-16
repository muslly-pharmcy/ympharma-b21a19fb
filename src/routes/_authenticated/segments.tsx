import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { listSegments, previewSegment } from '@/lib/campaigns.functions'
import { upsertSegment, recalcSegment } from '@/lib/campaigns.mutations.functions'
import type { SerializableRule } from '@/domain/crm/campaigns-schemas'

export const Route = createFileRoute('/_authenticated/segments')({
  component: SegmentsPage,
  head: () => ({ meta: [{ title: 'الشرائح — MUSLLY' }] }),
  errorComponent: ({ error }) => <div className="p-6 text-red-500">فشل التحميل: {(error as Error).message}</div>,
  notFoundComponent: () => <div className="p-6">غير موجود</div>,
})

const OP_LABELS: Record<string, string> = {
  is_new_within_days: 'عميل جديد خلال (أيام)',
  is_inactive_days: 'خامل لعدد أيام',
  city_equals: 'المدينة تساوي',
  has_tag: 'يحمل الوسم',
  loyalty_tier_code: 'مستوى ولاء (كود)',
  min_points_balance: 'رصيد نقاط ≥',
  max_points_balance: 'رصيد نقاط ≤',
  total_spend_gte: 'إجمالي إنفاق (نقاط) ≥',
  order_count_gte: 'عدد الطلبات ≥',
  recent_prescription_days: 'وصفة خلال (أيام)',
  customer_status: 'حالة العميل',
}

function SegmentsPage() {
  const list = useQuery({ queryKey: ['segments'], queryFn: () => listSegments() })
  const upsert = useServerFn(upsertSegment)
  const recalc = useServerFn(recalcSegment)
  const preview = useServerFn(previewSegment)

  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState('')
  const [combinator, setCombinator] = useState<'and'|'or'>('and')
  const [rules, setRules] = useState<SerializableRule[]>([])
  const [previewResult, setPreviewResult] = useState<{ count: number; sample: Array<{ id: string; full_name: string; code: string }> } | null>(null)

  function addRule(op: string) {
    const withDays = ['is_new_within_days','is_inactive_days','recent_prescription_days']
    const numericValue = ['min_points_balance','max_points_balance','total_spend_gte','order_count_gte']
    if (withDays.includes(op)) setRules([...rules, { op, days: 30 }])
    else if (numericValue.includes(op)) setRules([...rules, { op, value: 0 }])
    else setRules([...rules, { op, value: '' }])
  }

  const saveMut = useMutation({
    mutationFn: () => upsert({ data: { name: name.trim(), rules, combinator } }),
    onSuccess: () => { setShowNew(false); setName(''); setRules([]); setPreviewResult(null); list.refetch() },
  })

  async function runPreview() {
    const r = await preview({ data: { rules, combinator, limit: 25 } })
    setPreviewResult(r)
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">🎯 الشرائح</h1>
          <p className="text-sm text-slate-400">Dynamic Segmentation — DB-driven rules</p>
        </div>
        <div className="flex gap-2">
          <Link to="/campaigns" className="rounded-lg bg-slate-800 hover:bg-slate-700 px-4 py-2">📣 الحملات</Link>
          <button onClick={() => setShowNew((v) => !v)} className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2">
            {showNew ? 'إلغاء' : '+ شريحة جديدة'}
          </button>
        </div>
      </header>

      {showNew && (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 space-y-4">
          <div className="flex gap-3">
            <input placeholder="اسم الشريحة *" value={name} onChange={(e) => setName(e.target.value)} className="flex-1 rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2" />
            <select value={combinator} onChange={(e) => setCombinator(e.target.value as 'and'|'or')} className="rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2">
              <option value="and">جميع القواعد (AND)</option>
              <option value="or">أي قاعدة (OR)</option>
            </select>
          </div>

          <div className="space-y-2">
            {rules.map((r, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-900/60 border border-white/10 p-2">
                <span className="text-sm text-slate-300 flex-shrink-0 min-w-[180px]">{OP_LABELS[r.op] ?? r.op}</span>
                {'days' in r && (
                  <input type="number" min={1} value={r.days ?? 0} onChange={(e) => {
                    const copy = [...rules]; copy[i] = { ...r, days: Number(e.target.value) }; setRules(copy)
                  }} className="w-24 rounded bg-slate-800/70 border border-white/10 px-2 py-1" />
                )}
                {'value' in r && (
                  <input value={String(r.value ?? '')} onChange={(e) => {
                    const copy = [...rules]
                    const v = e.target.value
                    copy[i] = { ...r, value: /^\d+(\.\d+)?$/.test(v) ? Number(v) : v }
                    setRules(copy)
                  }} className="flex-1 rounded bg-slate-800/70 border border-white/10 px-2 py-1" />
                )}
                <button onClick={() => setRules(rules.filter((_, j) => j !== i))} className="text-red-300 text-sm px-2">✕</button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap">
            {Object.entries(OP_LABELS).map(([op, label]) => (
              <button key={op} onClick={() => addRule(op)} className="text-xs bg-slate-800/70 hover:bg-slate-700 border border-white/10 rounded px-2 py-1">
                + {label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={runPreview} className="rounded-lg bg-blue-500 hover:bg-blue-400 text-slate-950 font-semibold px-4 py-2">معاينة</button>
            <button disabled={!name || saveMut.isPending} onClick={() => saveMut.mutate()} className="rounded-lg bg-emerald-500 disabled:opacity-40 text-slate-950 font-semibold px-4 py-2">
              {saveMut.isPending ? 'جارٍ الحفظ...' : 'حفظ'}
            </button>
          </div>
          {saveMut.isError && <div className="text-red-300 text-sm">{(saveMut.error as Error).message}</div>}
          {previewResult && (
            <div className="rounded-lg bg-slate-900/60 border border-white/10 p-3 text-sm">
              <div className="mb-2 text-slate-300">النتيجة: <span className="font-bold text-emerald-300">{previewResult.count}</span> عميل</div>
              <ul className="text-xs text-slate-400 space-y-1 max-h-40 overflow-auto">
                {previewResult.sample.map((c) => <li key={c.id}>{c.full_name} <span className="font-mono">({c.code})</span></li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        {(list.data ?? []).map((s) => (
          <div key={s.id} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{s.name}</h3>
                <p className="text-xs text-slate-400 font-mono">{s.code}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-emerald-300">{s.member_count.toLocaleString('ar-EG')}</div>
                <div className="text-xs text-slate-400">عضو</div>
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-400">
              {s.rules.length} قاعدة · {s.combinator.toUpperCase()} · آخر حساب: {s.last_recalculated_at ? new Date(s.last_recalculated_at).toLocaleString('ar-EG') : 'لم يُحسب بعد'}
            </div>
            <button onClick={async () => { await recalc({ data: { id: s.id } }); list.refetch() }} className="mt-3 text-xs bg-blue-500 hover:bg-blue-400 text-slate-950 font-semibold px-3 py-1.5 rounded">إعادة حساب</button>
          </div>
        ))}
        {list.isSuccess && (list.data ?? []).length === 0 && (
          <div className="md:col-span-2 rounded-2xl border border-dashed border-white/10 p-8 text-center text-slate-400">لا توجد شرائح بعد</div>
        )}
      </div>
    </div>
  )
}
