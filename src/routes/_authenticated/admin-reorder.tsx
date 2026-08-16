import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { RefreshCw, TrendingDown, PackagePlus, Loader2 } from 'lucide-react'
import {
  decideReorderSuggestion,
  listReorderSuggestions,
  refreshReorder,
} from '@/lib/reorder.functions'
import { RouteLoadError } from '@/shared/components/RouteLoadError'

export const Route = createFileRoute('/_authenticated/admin-reorder')({
  component: ReorderPage,
  head: () => ({
    meta: [
      { title: 'اقتراحات إعادة الطلب التنبؤية | صيدلية المصلي' },
      {
        name: 'description',
        content:
          'لوحة تنبؤية تحسب معدل الاستهلاك اليومي ونقطة إعادة الطلب لكل صنف لتفادي نفاد المخزون.',
      },
      { property: 'og:title', content: 'اقتراحات إعادة الطلب التنبؤية' },
      {
        property: 'og:description',
        content: 'تنبؤ بالمخزون الناقص بناءً على الاستهلاك الفعلي ومدة التوريد.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  errorComponent: ({ error, reset }) => (
    <RouteLoadError title="تعذّر تحميل اقتراحات إعادة الطلب" error={error} reset={reset} />
  ),
  notFoundComponent: () => <div className="p-6">الصفحة غير موجودة</div>,
})

function coverTone(days: number | null): string {
  if (days === null) return 'bg-slate-100 text-slate-600'
  if (days <= 7) return 'bg-red-100 text-red-700'
  if (days <= 21) return 'bg-amber-100 text-amber-800'
  return 'bg-emerald-100 text-emerald-700'
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-teal-100 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone ?? 'text-slate-900'}`}>{value}</p>
    </div>
  )
}

function ReorderPage() {
  const queryClient = useQueryClient()
  const [leadTimeDays, setLeadTimeDays] = useState(14)

  const list = useServerFn(listReorderSuggestions)
  const refresh = useServerFn(refreshReorder)
  const decide = useServerFn(decideReorderSuggestion)

  const { data, isLoading } = useQuery({
    queryKey: ['reorder-suggestions'],
    queryFn: () => list({ data: { status: 'open' as const } }),
  })

  const refreshMutation = useMutation({
    mutationFn: () => refresh({ data: { leadTimeDays } }),
    onSuccess: (result) => {
      toast.success(`تم تحديث ${result.persisted} اقتراح إعادة طلب`)
      void queryClient.invalidateQueries({ queryKey: ['reorder-suggestions'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const decideMutation = useMutation({
    mutationFn: (vars: { id: string; status: 'dismissed' | 'ordered' }) => decide({ data: vars }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['reorder-suggestions'] }),
    onError: (error: Error) => toast.error(error.message),
  })

  const rows = useMemo(() => data ?? [], [data])
  const critical = useMemo(() => rows.filter((r) => (r.days_of_cover ?? 999) <= 7).length, [rows])
  const totalQty = useMemo(() => rows.reduce((sum, r) => sum + r.suggested_qty, 0), [rows])

  return (
    <div dir="rtl" className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">اقتراحات إعادة الطلب التنبؤية</h1>
          <p className="mt-1 text-sm text-slate-600">
            تُحسب من الاستهلاك الفعلي خلال آخر ٩٠ يوماً مع مخزون أمان يراعي تذبذب الطلب.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label htmlFor="lead-time" className="block text-xs text-slate-500">
              مدة التوريد (يوم)
            </label>
            <input
              id="lead-time"
              type="number"
              min={1}
              max={180}
              value={leadTimeDays}
              onChange={(e) => setLeadTimeDays(Number(e.target.value) || 14)}
              className="mt-1 h-10 w-24 rounded-lg border border-slate-300 px-2 text-sm"
            />
          </div>
          <button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="flex h-10 items-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {refreshMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            إعادة الحساب
          </button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="أصناف تحتاج طلباً" value={String(rows.length)} />
        <StatCard label="حرِج (≤ ٧ أيام)" value={String(critical)} tone="text-red-600" />
        <StatCard label="إجمالي الكميات المقترحة" value={totalQty.toLocaleString('ar')} />
      </div>

      <div className="overflow-hidden rounded-xl border border-teal-100 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> جارٍ التحميل…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-slate-500">
            <PackagePlus className="h-8 w-8" />
            <p>لا توجد اقتراحات حالياً — كل الأصناف ضمن مستوى الأمان.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-teal-50 text-xs text-slate-600">
                <tr>
                  <th className="p-3">الصنف</th>
                  <th className="p-3">المخزن</th>
                  <th className="p-3">المتوفر</th>
                  <th className="p-3">الاستهلاك/يوم</th>
                  <th className="p-3">التغطية</th>
                  <th className="p-3">نقطة الطلب</th>
                  <th className="p-3">الكمية المقترحة</th>
                  <th className="p-3">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="p-3 font-medium text-slate-900">
                      {row.product_name ?? row.product_id}
                    </td>
                    <td className="p-3 text-slate-500">{row.warehouse_name ?? '—'}</td>
                    <td className="p-3">{row.on_hand.toLocaleString('ar')}</td>
                    <td className="p-3">{row.daily_burn_rate.toFixed(2)}</td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${coverTone(row.days_of_cover)}`}
                      >
                        <TrendingDown className="h-3 w-3" />
                        {row.days_of_cover === null ? '—' : `${Math.round(row.days_of_cover)} يوم`}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500">{row.reorder_point}</td>
                    <td className="p-3 font-bold text-teal-700">{row.suggested_qty}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button
                          disabled={decideMutation.isPending}
                          onClick={() => decideMutation.mutate({ id: row.id, status: 'ordered' })}
                          className="rounded-md bg-teal-600 px-3 py-1 text-xs text-white disabled:opacity-60"
                        >
                          تم الطلب
                        </button>
                        <button
                          disabled={decideMutation.isPending}
                          onClick={() => decideMutation.mutate({ id: row.id, status: 'dismissed' })}
                          className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600 disabled:opacity-60"
                        >
                          تجاهل
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
