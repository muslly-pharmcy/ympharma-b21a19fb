import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { motion } from 'framer-motion'
import { ReceiptText, RotateCcw, Wallet, PieChart } from 'lucide-react'
import { listModuleTransactions } from '@/lib/modules.functions'
import { formatYerAmount, type BillingEntryType, type BillingPeriod } from '@/lib/billing-display'
import { Skeleton } from '@/components/skeletons/Skeleton'

const PERIODS: BillingPeriod[] = ['day', 'week', 'month', 'year']
const PERIOD_LABELS: Record<BillingPeriod, string> = {
  day: 'اليوم', week: 'الأسبوع', month: 'الشهر', year: 'السنة',
}
const ENTRY_LABELS: Record<BillingEntryType, string> = {
  charge: 'رسوم', refund: 'استرداد', credit: 'ائتمان', adjustment: 'تسوية',
}

export function FinanceModule() {
  const [period, setPeriod] = useState<BillingPeriod>('day')
  const fetchTx = useServerFn(listModuleTransactions)
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['module', 'billing-entries', period],
    queryFn: () => fetchTx({ data: { period } }),
    staleTime: 30_000,
  })
  const transactions = data?.items ?? []
  const charges = transactions.filter((tx) => tx.type === 'charge').length
  const refunds = transactions.filter((tx) => tx.type === 'refund').length
  const other = transactions.filter((tx) => tx.type === 'credit' || tx.type === 'adjustment').length
  const summaries = [
    { label: 'عدد حركات الرسوم المعروضة', value: charges, icon: ReceiptText, color: 'text-green-600' },
    { label: 'عدد الاستردادات المعروضة', value: refunds, icon: RotateCcw, color: 'text-red-600' },
    { label: 'عدد الاعتمادات والتسويات المعروضة', value: other, icon: Wallet, color: 'text-blue-600' },
  ]

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="note">
        سجل فوترة الخدمات: هذه الحركات ليست دفتر الأستاذ العام ولا تثبت إيرادات الصيدلية أو صافي أرباحها.
        الأعداد أدناه تخص الحركات المعروضة فقط (بحد أقصى 100). الفترة بتوقيت عدن.
      </div>

      <div className="glass-panel rounded-2xl p-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="الفترة الزمنية">
          {PERIODS.map((p) => (
            <button
              type="button"
              key={p}
              aria-pressed={period === p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${period === p ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {isError ? (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-5 text-red-800">
          <p className="font-semibold">تعذر تحميل بيانات الفوترة. لا يمكن اعتبار القيم صفرًا.</p>
          <button type="button" className="mt-3 underline" onClick={() => void refetch()}>
            إعادة المحاولة
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {summaries.map(({ label, value, icon: Icon, color }) => (
              <div className="glass-panel rounded-2xl p-5" key={label}>
                <Icon className={`w-6 h-6 mb-3 ${color}`} />
                <p className="text-2xl font-bold text-gray-900">
                  {isLoading ? '—' : value.toLocaleString('ar-YE')}
                </p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            ))}
          </div>
          {data?.truncated && (
            <div role="status" className="rounded-xl border border-amber-300 p-3 text-sm">
              يوجد أكثر من 100 قيد في الفترة المحددة؛ المعروض جزء من السجل ولا يمثل إجمالي الفترة.
            </div>
          )}
          <div className="glass-panel rounded-2xl p-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-primary" />
              آخر حركات الفوترة
            </h3>
            <div className="space-y-3">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)
              ) : transactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>لا توجد حركات فوترة في الفترة المحددة.</p>
                </div>
              ) : (
                transactions.map((tx, i) => (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center justify-between gap-4 p-3 bg-gray-50 rounded-xl"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{tx.description || ENTRY_LABELS[tx.type]}</p>
                      <p className="text-xs text-gray-500">
                        {ENTRY_LABELS[tx.type]} {tx.subjectType ? `· ${tx.subjectType}` : ''}
                      </p>
                    </div>
                    <div className="text-left shrink-0">
                      <p className="font-bold text-gray-900" dir="ltr">{formatYerAmount(tx.amountYer)} ر.ي</p>
                      <p className="text-xs text-gray-400">
                        {new Date(tx.createdAt).toLocaleDateString('ar-YE', { timeZone: 'Asia/Aden' })}
                      </p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
