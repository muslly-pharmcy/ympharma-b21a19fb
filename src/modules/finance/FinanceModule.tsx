import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { listModuleTransactions } from '@/lib/modules.functions'
import type { BillingPeriod } from '@/lib/billing-ledger'
import { Skeleton } from '@/components/skeletons/Skeleton'

const labels = { charge: 'تحميل مبلغ', refund: 'استرداد', credit: 'ائتمان', adjustment: 'تسوية' }
const periods: Record<BillingPeriod, string> = { day: 'اليوم', week: 'الأسبوع', month: 'الشهر', year: 'السنة' }

export function FinanceModule() {
  const [period, setPeriod] = useState<BillingPeriod>('day')
  const fetchTx = useServerFn(listModuleTransactions)
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['module', 'finance-transactions', period],
    queryFn: () => fetchTx({ data: { period } }),
    staleTime: 30_000,
  })

  return (
    <div dir="rtl" className="space-y-6">
      <div className="glass-panel rounded-2xl p-5 space-y-2">
        <h2 className="text-xl font-bold">سجل الفوترة</h2>
        <p className="text-sm text-muted-foreground">حركات فوترة الاشتراكات. حساب الإيرادات والمصروفات وصافي الربح يتطلب دفتر الأستاذ المعتمد.</p>
        <p className="text-xs text-muted-foreground">الفترة حسب توقيت عدن؛ يبدأ الأسبوع يوم السبت.</p>
      </div>
      <div className="flex gap-2 flex-wrap" aria-label="فترة الفوترة">
        {(Object.keys(periods) as BillingPeriod[]).map((p) => (
          <button key={p} onClick={() => setPeriod(p)} aria-pressed={period === p}
            className={`px-4 py-2 rounded-xl text-sm ${period === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            {periods[p]}
          </button>
        ))}
      </div>
      {isError ? (
        <div role="alert" className="glass-panel rounded-2xl p-5 space-y-3">
          <p>تعذر تحميل سجل الفوترة أو لا تملك صلاحية عرضه.</p>
          <button onClick={() => void refetch()} className="text-primary underline">إعادة المحاولة</button>
        </div>
      ) : isPending ? <Skeleton className="h-40" /> : (
        <div className="glass-panel rounded-2xl p-4 overflow-x-auto">
          {data.truncated && <p role="status" className="text-sm text-muted-foreground mb-3">يُعرض أحدث 100 حركة فقط؛ القائمة ليست إجمالي الفترة.</p>}
          {data.items.length === 0 ? <p className="py-8 text-center text-muted-foreground">لا توجد حركات في الفترة المحددة</p> : (
            <table className="w-full text-sm text-start">
              <caption className="sr-only">حركات الفوترة خلال الفترة المحددة</caption>
              <thead><tr>{['النوع', 'المبلغ (ر.ي)', 'البيان', 'التاريخ'].map((label) => <th key={label} scope="col" className="p-3 text-start">{label}</th>)}</tr></thead>
              <tbody>{data.items.map((entry) => (
                <tr key={entry.id} className="border-t border-border">
                  <td className="p-3">{labels[entry.entry_type]}</td>
                  <td className="p-3 tabular-nums" dir="ltr">{entry.amount_yer}</td>
                  <td className="p-3">{entry.notes ?? '—'}</td>
                  <td className="p-3">{new Date(entry.created_at).toLocaleString('ar-YE', { timeZone: 'Asia/Aden' })}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
