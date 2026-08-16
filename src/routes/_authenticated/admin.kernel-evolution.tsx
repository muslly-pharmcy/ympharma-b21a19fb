import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, Brain, Info, RefreshCw } from 'lucide-react'
import {
  getKernelEvolution,
  type KernelProposal,
} from '@/lib/kernel-evolution.functions'

export const Route = createFileRoute('/_authenticated/admin/kernel-evolution')({
  head: () => ({
    meta: [
      { title: 'تطوّر نواة الذكاء — صيدلية المصلي' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: KernelEvolutionPage,
})

const SEVERITY_STYLE: Record<KernelProposal['severity'], string> = {
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  critical: 'border-rose-200 bg-rose-50 text-rose-800',
}

function KernelEvolutionPage() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['kernel-evolution'],
    queryFn: () => getKernelEvolution(),
    refetchInterval: 60_000,
  })

  const t = data?.telemetry

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pt-24 md:p-8 md:pt-24" dir="rtl">
      <header className="flex flex-wrap items-center gap-3">
        <Brain className="h-6 w-6 text-primary" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">تطوّر نواة الذكاء</h1>
          <p className="text-sm text-gray-500">
            قياسات حيّة ومقترحات تحسين ذاتية — لا يُطبَّق أي مقترح تلقائيًا.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metric label="أخطاء (24س)" value={t?.errors24h} />
        <Metric label="تشغيل وكلاء (24س)" value={t?.agentRuns24h} />
        <Metric label="فشل وكلاء (24س)" value={t?.agentFailures24h} />
        <Metric label="اقتراحات إعادة طلب" value={t?.openReorderSuggestions} />
        <Metric label="طابور DLQ (7 أيام)" value={t?.dlqDepth} />
      </section>

      <section className="space-y-3">
        {(data?.proposals ?? []).map((p) => (
          <article
            key={p.id}
            className={`rounded-2xl border p-4 shadow-sm ${SEVERITY_STYLE[p.severity]}`}
          >
            <div className="flex items-center gap-2">
              {p.severity === 'info' ? (
                <Info className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <h2 className="text-sm font-semibold">{p.title}</h2>
            </div>
            <p className="mt-1.5 text-sm">{p.detail}</p>
            <p className="mt-2 text-xs font-medium opacity-80">الإجراء المقترح: {p.action}</p>
          </article>
        ))}
      </section>

      {data && (
        <p className="text-center text-xs text-gray-400">
          آخر تحديث: {new Date(data.generatedAt).toLocaleString('ar-EG')}
        </p>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white/80 p-3 text-center shadow-sm backdrop-blur">
      <Activity className="mx-auto mb-1 h-4 w-4 text-primary" />
      <p className="text-lg font-bold text-gray-900">{value ?? '—'}</p>
      <p className="text-[11px] text-gray-500">{label}</p>
    </div>
  )
}
