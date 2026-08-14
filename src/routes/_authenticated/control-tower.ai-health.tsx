import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, BrainCircuit, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { ControlTowerShell, GlassCard } from '@/components/admin/ControlTowerShell'
import { getAiHealth } from '@/lib/ai/ai-health.functions'

export const Route = createFileRoute('/_authenticated/control-tower/ai-health')({
  head: () => ({
    meta: [
      { title: 'صحة الذكاء الاصطناعي — الإدارة المركزية' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: AiHealthPage,
})

const ERROR_LABELS_AR: Record<string, string> = {
  no_credit: 'رصيد المزوّد منتهٍ',
  unauthorized: 'مفتاح غير صالح',
  forbidden: 'وصول مرفوض',
  rate_limited: 'تجاوز حد الطلبات',
  invalid_request: 'طلب غير صالح',
  upstream: 'عطل لدى المزوّد',
  network: 'انقطاع شبكي',
  aborted: 'تم الإلغاء',
  missing_key: 'المفتاح غير مهيأ',
  malformed: 'مخرجات غير مطابقة',
}

const FEATURE_LABELS_AR: Record<string, string> = {
  'patient-chat': 'مساعد المرضى',
  'cosmic-search': 'البحث الذكي',
  'product-guide': 'دليل المنتجات',
  'product-imagery': 'صور المنتجات',
  'social-posts': 'منشورات التسويق',
  'social-posts-cron': 'منشورات مجدولة',
  vision: 'الرؤية والمسح',
  'vision-rx': 'مسح الروشتات',
  'vision-invoice': 'مسح الفواتير',
  unlabelled: 'غير مصنّف',
}

const STATUS_STYLES: Record<string, string> = {
  healthy: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  degraded: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  critical: 'bg-red-500/15 text-red-300 border-red-500/30',
  idle: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
}

const STATUS_AR: Record<string, string> = {
  healthy: 'سليم',
  degraded: 'متذبذب',
  critical: 'حرج',
  idle: 'خامل',
}

function pct(v: number) {
  return `${Math.round(v * 100)}%`
}

function AiHealthPage() {
  const [hours, setHours] = useState(24)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['ai-health', hours],
    queryFn: () => getAiHealth({ data: { hours } }),
    refetchInterval: 60_000,
  })

  return (
    <ControlTowerShell
      title="صحة الذكاء الاصطناعي"
      subtitle="لوحة قراءة فقط لكل نداءات الذكاء في النظام: المعدل، الأعطال، الكلفة التقريبية والمزوّد المستخدم."
    >
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {[6, 24, 72, 168].map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => setHours(h)}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
              hours === h
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]'
            }`}
          >
            آخر {h} ساعة
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
        </div>
      ) : isError || !data ? (
        <GlassCard className="text-center text-sm text-red-200">
          <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-red-400" />
          تعذّر تحميل بيانات صحة الذكاء.
        </GlassCard>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <GlassCard>
              <p className="text-xs text-slate-400">إجمالي النداءات</p>
              <p className="mt-1 text-2xl font-bold text-white">{data.totals.calls}</p>
            </GlassCard>
            <GlassCard>
              <p className="text-xs text-slate-400">نسبة الفشل</p>
              <p
                className={`mt-1 text-2xl font-bold ${
                  data.totals.errorRate > 0.1 ? 'text-amber-300' : 'text-emerald-300'
                }`}
              >
                {pct(data.totals.errorRate)}
              </p>
            </GlassCard>
            <GlassCard>
              <p className="text-xs text-slate-400">متوسط الاستجابة</p>
              <p className="mt-1 text-2xl font-bold text-white">{data.totals.avgLatencyMs} م.ث</p>
            </GlassCard>
            <GlassCard>
              <p className="text-xs text-slate-400">الوحدات المستهلكة (توكن)</p>
              <p className="mt-1 text-2xl font-bold text-white">{data.totals.tokens}</p>
            </GlassCard>
          </div>

          <GlassCard>
            <div className="mb-3 flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">حالة المزوّدين</h2>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <span
                className={`rounded-full border px-3 py-1 ${
                  data.providers.openaiKeyConfigured
                    ? STATUS_STYLES['healthy']
                    : STATUS_STYLES['idle']
                }`}
              >
                المزوّد المباشر: {data.providers.openaiKeyConfigured ? 'مهيّأ' : 'غير مهيّأ'}
              </span>
              <span
                className={`rounded-full border px-3 py-1 ${
                  data.providers.gatewayKeyConfigured
                    ? STATUS_STYLES['healthy']
                    : STATUS_STYLES['critical']
                }`}
              >
                البوابة المُدارة: {data.providers.gatewayKeyConfigured ? 'مهيّأة' : 'غير مهيّأة'}
              </span>
            </div>
          </GlassCard>

          <GlassCard>
            <h2 className="mb-3 text-sm font-semibold text-white">الحالة حسب الميزة</h2>
            {data.byFeature.length === 0 ? (
              <p className="text-sm text-slate-400">لا توجد نداءات مسجّلة في هذه الفترة.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-right text-sm">
                  <thead className="text-xs text-slate-400">
                    <tr>
                      <th className="pb-2 font-medium">الميزة</th>
                      <th className="pb-2 font-medium">النداءات</th>
                      <th className="pb-2 font-medium">الفشل</th>
                      <th className="pb-2 font-medium">الاستجابة</th>
                      <th className="pb-2 font-medium">أبرز خطأ</th>
                      <th className="pb-2 font-medium">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.byFeature.map((f) => (
                      <tr key={f.feature}>
                        <td className="py-2 text-slate-100">
                          {FEATURE_LABELS_AR[f.feature] ?? f.feature}
                        </td>
                        <td className="py-2 text-slate-300">{f.calls}</td>
                        <td className="py-2 text-slate-300">{pct(f.errorRate)}</td>
                        <td className="py-2 text-slate-300">{f.avgLatencyMs} م.ث</td>
                        <td className="py-2 text-slate-300">
                          {f.topErrorClass
                            ? (ERROR_LABELS_AR[f.topErrorClass] ?? f.topErrorClass)
                            : '—'}
                        </td>
                        <td className="py-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLES[f.status]}`}
                          >
                            {STATUS_AR[f.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <GlassCard>
              <h2 className="mb-3 text-sm font-semibold text-white">تصنيف الأعطال</h2>
              {data.byErrorClass.length === 0 ? (
                <p className="text-sm text-emerald-300">لا توجد أعطال مسجّلة.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.byErrorClass.map((e) => (
                    <li key={e.errorClass} className="flex justify-between text-slate-300">
                      <span>{ERROR_LABELS_AR[e.errorClass] ?? e.errorClass}</span>
                      <span className="font-semibold text-white">{e.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </GlassCard>

            <GlassCard>
              <h2 className="mb-3 text-sm font-semibold text-white">النماذج المستخدمة</h2>
              {data.byModel.length === 0 ? (
                <p className="text-sm text-slate-400">لا توجد بيانات.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.byModel.map((m) => (
                    <li key={m.model} className="flex justify-between text-slate-300">
                      <span className="font-mono text-xs">{m.model}</span>
                      <span className="text-white">
                        {m.calls} / <span className="text-red-300">{m.failures}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </GlassCard>
          </div>
        </div>
      )}
    </ControlTowerShell>
  )
}
