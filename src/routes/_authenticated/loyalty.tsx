import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { listLoyaltyAccounts, listLoyaltyTiers } from '@/lib/loyalty.functions'

export const Route = createFileRoute('/_authenticated/loyalty')({
  component: LoyaltyPage,
  head: () => ({ meta: [{ title: 'الولاء — MUSLLY' }] }),
  errorComponent: ({ error }) => <div className="p-6 text-red-500">فشل التحميل: {(error as Error).message}</div>,
  notFoundComponent: () => <div className="p-6">غير موجود</div>,
})

function LoyaltyPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'active' | 'frozen' | 'closed' | 'all'>('active')
  const accounts = useQuery({ queryKey: ['loyalty-accounts', status, search], queryFn: () => listLoyaltyAccounts({ data: { search, status } }) })
  const tiers = useQuery({ queryKey: ['loyalty-tiers'], queryFn: () => listLoyaltyTiers() })

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">💎 الولاء</h1>
          <p className="text-sm text-slate-400">CRM D2 — Ledger-based Loyalty Engine</p>
        </div>
        <Link to="/rewards" className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2">🎁 الجوائز</Link>
      </header>

      <section className="grid md:grid-cols-4 gap-3">
        {(tiers.data ?? []).map((t) => (
          <div key={t.id} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: t.color ?? '#888' }} />
              <span className="font-semibold">{t.name}</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">≥ {t.min_lifetime_points.toLocaleString('ar-EG')} نقطة · ×{t.multiplier}</div>
          </div>
        ))}
        {tiers.isSuccess && (tiers.data ?? []).length === 0 && (
          <div className="md:col-span-4 rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">
            لا توجد مستويات بعد — سيتم إنشاؤها تلقائيًا عند أول إصدار نقاط.
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالاسم أو كود العميل..."
          className="flex-1 min-w-[220px] rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2" />
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}
          className="rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2">
          <option value="active">نشط</option>
          <option value="frozen">مجمّد</option>
          <option value="closed">مغلق</option>
          <option value="all">الكل</option>
        </select>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-slate-300">
            <tr>
              <th className="text-right px-4 py-2">كود العميل</th>
              <th className="text-right px-4 py-2">الاسم</th>
              <th className="text-right px-4 py-2">الرصيد</th>
              <th className="text-right px-4 py-2">إجمالي مكتسب</th>
              <th className="text-right px-4 py-2">الحالة</th>
              <th className="text-right px-4 py-2">آخر تحديث</th>
            </tr>
          </thead>
          <tbody>
            {(accounts.data ?? []).map((a) => (
              <tr key={a.id} className="border-t border-white/5 hover:bg-white/5">
                <td className="px-4 py-2 font-mono text-emerald-300">
                  <Link to="/loyalty/$accountId" params={{ accountId: a.id }}>{a.customer_code}</Link>
                </td>
                <td className="px-4 py-2">{a.customer_name}</td>
                <td className="px-4 py-2 font-semibold">{a.points_balance.toLocaleString('ar-EG')}</td>
                <td className="px-4 py-2 text-slate-400">{a.points_lifetime_earned.toLocaleString('ar-EG')}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    a.status === 'active' ? 'bg-emerald-500/20 text-emerald-300'
                    : a.status === 'frozen' ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-slate-500/20 text-slate-300'
                  }`}>{a.status}</span>
                </td>
                <td className="px-4 py-2 text-slate-400">{new Date(a.updated_at).toLocaleString('ar-EG')}</td>
              </tr>
            ))}
            {accounts.isSuccess && (accounts.data ?? []).length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">لا توجد حسابات ولاء بعد. أنشئها بإصدار نقاط لعميل من صفحة العميل.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
