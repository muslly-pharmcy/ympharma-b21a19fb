import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { getLoyaltyAccount } from '@/lib/loyalty.functions'
import { issuePoints, redeemPoints, adjustPoints, reversePoints } from '@/lib/loyalty.mutations.functions'

export const Route = createFileRoute('/_authenticated/loyalty/$accountId')({
  component: AccountPage,
  head: () => ({ meta: [{ title: 'حساب ولاء — MUSLLY' }] }),
  errorComponent: ({ error }) => <div className="p-6 text-red-500">فشل التحميل: {(error as Error).message}</div>,
  notFoundComponent: () => <div className="p-6">غير موجود</div>,
})

const KIND_LABEL: Record<string, string> = {
  earn: 'كسب', redeem: 'استبدال', reverse: 'عكس', expire: 'انتهاء', adjust: 'تعديل', bonus: 'مكافأة',
}

function AccountPage() {
  const { accountId } = Route.useParams()
  const q = useQuery({ queryKey: ['loyalty', accountId], queryFn: () => getLoyaltyAccount({ data: { id: accountId } }) })

  const issue = useServerFn(issuePoints)
  const redeem = useServerFn(redeemPoints)
  const adjust = useServerFn(adjustPoints)
  const reverse = useServerFn(reversePoints)

  const [issueForm, setIssueForm] = useState({ points: '', reason: '' })
  const [redeemForm, setRedeemForm] = useState({ points: '', reason: '' })
  const [adjustForm, setAdjustForm] = useState({ points: '', reason: '' })

  const customerId = q.data?.customer.id ?? ''

  const issueMut = useMutation({
    mutationFn: () => issue({ data: { customerId, points: Number(issueForm.points), reason: issueForm.reason || undefined, idempotencyKey: crypto.randomUUID() } }),
    onSuccess: () => { setIssueForm({ points: '', reason: '' }); q.refetch() },
  })
  const redeemMut = useMutation({
    mutationFn: () => redeem({ data: { customerId, points: Number(redeemForm.points), reason: redeemForm.reason || undefined, idempotencyKey: crypto.randomUUID() } }),
    onSuccess: () => { setRedeemForm({ points: '', reason: '' }); q.refetch() },
  })
  const adjustMut = useMutation({
    mutationFn: () => adjust({ data: { customerId, points: Number(adjustForm.points), reason: adjustForm.reason, idempotencyKey: crypto.randomUUID() } }),
    onSuccess: () => { setAdjustForm({ points: '', reason: '' }); q.refetch() },
  })
  const reverseMut = useMutation({
    mutationFn: (transactionId: string) => reverse({ data: { transactionId, idempotencyKey: crypto.randomUUID() } }),
    onSuccess: () => q.refetch(),
  })

  if (q.isLoading) return <div className="p-6 text-slate-400">جارٍ التحميل...</div>
  if (!q.data) return <div className="p-6 text-slate-400">لا يوجد حساب</div>

  const { account, tier, customer, transactions, redemptions } = q.data

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/loyalty" className="text-sm text-slate-400 hover:text-slate-200">← عودة</Link>
          <h1 className="text-3xl font-bold mt-1">{customer.full_name}</h1>
          <div className="text-sm text-slate-400 font-mono">{customer.code}</div>
        </div>
        {tier && (
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur px-4 py-3 text-right">
            <div className="text-xs text-slate-400">المستوى</div>
            <div className="text-lg font-semibold flex items-center gap-2 justify-end">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: tier.color ?? '#888' }} />
              {tier.name}
            </div>
          </div>
        )}
      </div>

      <section className="grid md:grid-cols-3 gap-3">
        <Stat label="الرصيد الحالي" value={account.points_balance} accent="emerald" />
        <Stat label="إجمالي المكتسب" value={account.points_lifetime_earned} accent="sky" />
        <Stat label="عدد الحركات" value={transactions.length} accent="violet" />
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        <ActionCard title="إصدار نقاط (Bonus)" onSubmit={() => issueMut.mutate()} disabled={!issueForm.points || issueMut.isPending} error={issueMut.error as Error | null}>
          <input type="number" min={1} placeholder="عدد النقاط" value={issueForm.points} onChange={(e) => setIssueForm({ ...issueForm, points: e.target.value })} className="w-full rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2" />
          <input placeholder="السبب (اختياري)" value={issueForm.reason} onChange={(e) => setIssueForm({ ...issueForm, reason: e.target.value })} className="w-full rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2" />
        </ActionCard>
        <ActionCard title="استبدال نقاط" onSubmit={() => redeemMut.mutate()} disabled={!redeemForm.points || redeemMut.isPending} error={redeemMut.error as Error | null}>
          <input type="number" min={1} placeholder="عدد النقاط" value={redeemForm.points} onChange={(e) => setRedeemForm({ ...redeemForm, points: e.target.value })} className="w-full rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2" />
          <input placeholder="السبب (اختياري)" value={redeemForm.reason} onChange={(e) => setRedeemForm({ ...redeemForm, reason: e.target.value })} className="w-full rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2" />
        </ActionCard>
        <ActionCard title="تعديل يدوي (± نقطة)" onSubmit={() => adjustMut.mutate()} disabled={!adjustForm.points || !adjustForm.reason || adjustMut.isPending} error={adjustMut.error as Error | null}>
          <input type="number" placeholder="مثلاً 10 أو -10" value={adjustForm.points} onChange={(e) => setAdjustForm({ ...adjustForm, points: e.target.value })} className="w-full rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2" />
          <input placeholder="السبب (إلزامي)" value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} className="w-full rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2" />
        </ActionCard>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">📜 دفتر الحركات (Ledger)</h2>
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-slate-300">
              <tr>
                <th className="text-right px-4 py-2">التاريخ</th>
                <th className="text-right px-4 py-2">النوع</th>
                <th className="text-right px-4 py-2">النقاط</th>
                <th className="text-right px-4 py-2">السبب</th>
                <th className="text-right px-4 py-2">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-t border-white/5">
                  <td className="px-4 py-2 text-slate-400">{new Date(t.created_at).toLocaleString('ar-EG')}</td>
                  <td className="px-4 py-2">
                    <span className="text-xs px-2 py-1 rounded bg-slate-700/50">{KIND_LABEL[t.kind] ?? t.kind}</span>
                  </td>
                  <td className={`px-4 py-2 font-mono ${t.points >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {t.points > 0 ? `+${t.points}` : t.points}
                  </td>
                  <td className="px-4 py-2 text-slate-300">{t.reason ?? '—'}</td>
                  <td className="px-4 py-2">
                    {(t.kind === 'earn' || t.kind === 'bonus') && (
                      <button
                        onClick={() => reverseMut.mutate(t.id)}
                        disabled={reverseMut.isPending}
                        className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 disabled:opacity-40"
                      >عكس</button>
                    )}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">لا توجد حركات بعد</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {redemptions.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3">🎁 استبدال الجوائز</h2>
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-slate-300">
                <tr>
                  <th className="text-right px-4 py-2">التاريخ</th>
                  <th className="text-right px-4 py-2">النقاط</th>
                  <th className="text-right px-4 py-2">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {redemptions.map((r) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="px-4 py-2 text-slate-400">{new Date(r.created_at).toLocaleString('ar-EG')}</td>
                    <td className="px-4 py-2 font-mono text-rose-300">-{r.points_spent}</td>
                    <td className="px-4 py-2 text-xs">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent: 'emerald' | 'sky' | 'violet' }) {
  const color = accent === 'emerald' ? 'text-emerald-300' : accent === 'sky' ? 'text-sky-300' : 'text-violet-300'
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${color}`}>{value.toLocaleString('ar-EG')}</div>
    </div>
  )
}

function ActionCard({ title, children, onSubmit, disabled, error }: {
  title: string; children: React.ReactNode; onSubmit: () => void; disabled: boolean; error: Error | null
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 space-y-2">
      <h3 className="font-semibold">{title}</h3>
      {children}
      {error && <div className="text-xs text-red-300">{error.message}</div>}
      <button onClick={onSubmit} disabled={disabled}
        className="w-full rounded-lg bg-emerald-500 disabled:opacity-40 text-slate-950 font-semibold py-2">
        تنفيذ
      </button>
    </div>
  )
}
