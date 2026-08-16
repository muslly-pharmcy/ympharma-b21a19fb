import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery, queryOptions } from '@tanstack/react-query'
import { Suspense, lazy } from 'react'
import {
  getExecutiveKpis, getDispensesSeries, getCustomersGrowth,
  getCampaignsSummary, getInventoryHealth, getAiUsage,
  type ExecutiveKpis, type SeriesPoint, type CampaignPerf, type InventoryHealth, type AiUsage,
} from '@/lib/analytics.functions'
import { ClientOnly } from '@/shared/components/ClientOnly'
const AreaTrendChart = lazy(() => import('@/components/charts/AreaTrendChart'))
import { Activity, Users, Pill, Package, Sparkles, Megaphone, AlertTriangle, Download } from 'lucide-react'

const kpisQuery = queryOptions({ queryKey: ['analytics', 'kpis'], queryFn: () => getExecutiveKpis() })
const dispSeriesQuery = queryOptions({ queryKey: ['analytics', 'dispenses-14'], queryFn: () => getDispensesSeries({ data: { days: 14 } }) })
const custSeriesQuery = queryOptions({ queryKey: ['analytics', 'customers-30'], queryFn: () => getCustomersGrowth({ data: { days: 30 } }) })
const campaignsQuery = queryOptions({ queryKey: ['analytics', 'campaigns'], queryFn: () => getCampaignsSummary() })
const inventoryQuery = queryOptions({ queryKey: ['analytics', 'inventory'], queryFn: () => getInventoryHealth() })
const aiQuery = queryOptions({ queryKey: ['analytics', 'ai'], queryFn: () => getAiUsage() })

export const Route = createFileRoute('/_authenticated/analytics/')({
  head: () => ({ meta: [
    { title: 'التحليلات التنفيذية — MUSLLY AI OS' },
    { name: 'description', content: 'لوحة تحليلات تنفيذية شاملة: المبيعات، العملاء، المخزون، الحملات، وأداء الذكاء الاصطناعي.' },
    { property: 'og:title', content: 'التحليلات التنفيذية — MUSLLY' },
    { property: 'og:description', content: 'ذكاء أعمال في الوقت الحقيقي لعمليات الصيدلية.' },
  ] }),
  component: AnalyticsPage,
})

function AnalyticsPage() {
  return (
    <div dir="rtl" className="min-h-dvh bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 pb-24 md:pb-6 space-y-6">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-2xl sm:text-3xl font-bold">التحليلات التنفيذية</h1>
            <p className="text-sm text-slate-400">مؤشرات الأداء اللحظية عبر العمليات، العملاء، والذكاء الاصطناعي</p>
          </div>
        </header>
        <Suspense fallback={<Loader />}>
          <ExecutivePanel />
        </Suspense>
      </div>
    </div>
  )
}

function Loader() { return <div className="text-slate-400 text-sm">جارٍ تحميل التحليلات…</div> }

function ExecutivePanel() {
  const { data: kpis } = useSuspenseQuery(kpisQuery)
  const { data: dispSeries } = useSuspenseQuery(dispSeriesQuery)
  const { data: custSeries } = useSuspenseQuery(custSeriesQuery)
  const { data: campaigns } = useSuspenseQuery(campaignsQuery)
  const { data: inventory } = useSuspenseQuery(inventoryQuery)
  const { data: ai } = useSuspenseQuery(aiQuery)

  return (
    <div className="space-y-6">
      <KpiGrid kpis={kpis} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="عمليات الصرف — آخر 14 يوم" action={<ExportBtn rows={dispSeries} name="dispenses-14d" />}>
          <ClientOnly fallback={<ChartSkeleton />}><LineChartLazy data={dispSeries} color="#10b981" /></ClientOnly>
        </Card>
        <Card title="نمو العملاء — آخر 30 يوم" action={<ExportBtn rows={custSeries} name="customers-30d" />}>
          <ClientOnly fallback={<ChartSkeleton />}><LineChartLazy data={custSeries} color="#38bdf8" /></ClientOnly>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <InventoryCard inv={inventory} />
        <AiCard ai={ai} />
      </div>

      <CampaignsTable campaigns={campaigns} />
    </div>
  )
}

function KpiGrid({ kpis }: { kpis: ExecutiveKpis }) {
  const items = [
    { label: 'صرف اليوم', value: kpis.dispenses_today, icon: Pill, tone: 'emerald' },
    { label: 'صرف 7 أيام', value: kpis.dispenses_7d, icon: Activity, tone: 'emerald' },
    { label: 'عملاء جدد (7ي)', value: kpis.new_customers_7d, icon: Users, tone: 'sky' },
    { label: 'حملات نشطة', value: kpis.campaigns_active, icon: Megaphone, tone: 'violet' },
    { label: 'استدعاءات AI (24س)', value: kpis.ai_runs_24h, icon: Sparkles, tone: 'amber' },
    { label: 'مخزون منخفض', value: kpis.low_stock_items, icon: Package, tone: 'orange' },
    { label: 'قرب انتهاء (30ي)', value: kpis.expiring_soon_items, icon: AlertTriangle, tone: 'red' },
    { label: 'نقاط ولاء (30ي)', value: kpis.loyalty_points_earned_30d, icon: Sparkles, tone: 'amber' },
  ] as const
  return (
    <div className="bento-grid">
      {items.map((k, i) => (
        <div
          key={k.label}
          className={`rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-white/25 ${i === 0 ? 'bento-wide' : ''}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">{k.label}</span>
            <k.icon className="h-4 w-4 text-slate-500" aria-hidden />
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums">{k.value.toLocaleString('ar-EG')}</div>
        </div>
      ))}
    </div>
  )
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}

function ChartSkeleton() { return <div className="h-56 animate-pulse rounded-xl bg-white/5" /> }

function LineChartLazy({ data, color }: { data: SeriesPoint[]; color: string }) {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <AreaTrendChart data={data} color={color} />
    </Suspense>
  )
}

function InventoryCard({ inv }: { inv: InventoryHealth }) {
  const items = [
    { label: 'مخزون منخفض', value: inv.low_stock, tone: 'text-orange-300' },
    { label: 'نفدت الكمية', value: inv.out_of_stock, tone: 'text-red-300' },
    { label: 'ينتهي خلال 30 يوم', value: inv.expiring_30d, tone: 'text-amber-300' },
    { label: 'ينتهي خلال 90 يوم', value: inv.expiring_90d, tone: 'text-amber-300' },
    { label: 'إجمالي الدفعات', value: inv.total_batches, tone: 'text-slate-200' },
  ]
  return (
    <Card title="صحة المخزون">
      <ul className="grid grid-cols-2 gap-3">
        {items.map((i) => (
          <li key={i.label} className="rounded-xl border border-white/5 bg-slate-900/40 p-3">
            <div className="text-xs text-slate-400">{i.label}</div>
            <div className={`mt-1 text-xl font-bold ${i.tone}`}>{i.value.toLocaleString('ar-EG')}</div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function AiCard({ ai }: { ai: AiUsage }) {
  return (
    <Card title="أداء الذكاء الاصطناعي (7 أيام)">
      <div className="grid grid-cols-3 gap-3 mb-3">
        <Stat label="استدعاءات 24س" value={ai.runs_24h} />
        <Stat label="استدعاءات 7ي" value={ai.runs_7d} />
        <Stat label="متوسط الاستجابة" value={`${ai.avg_latency_ms_7d}ms`} />
      </div>
      <div className="text-xs text-slate-400 mb-2">أكثر الوكلاء استخدامًا</div>
      <ul className="space-y-1">
        {ai.top_agents.length === 0 && <li className="text-xs text-slate-500">لا يوجد نشاط بعد</li>}
        {ai.top_agents.map((a) => (
          <li key={a.agent_key} className="flex items-center justify-between text-sm">
            <span className="font-mono text-xs text-slate-300">{a.agent_key}</span>
            <span className="text-slate-400">{a.runs}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-slate-900/40 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-bold text-slate-100">{typeof value === 'number' ? value.toLocaleString('ar-EG') : value}</div>
    </div>
  )
}

function CampaignsTable({ campaigns }: { campaigns: CampaignPerf[] }) {
  return (
    <Card title="أداء الحملات (آخر 10)" action={<ExportBtn rows={campaigns} name="campaigns" />}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-400 text-xs">
            <tr>
              <th className="text-right py-2 px-2">الحملة</th>
              <th className="text-right py-2 px-2">القناة</th>
              <th className="text-right py-2 px-2">الحالة</th>
              <th className="text-right py-2 px-2 hidden sm:table-cell">الجمهور</th>
              <th className="text-right py-2 px-2">أُرسلت</th>
              <th className="text-right py-2 px-2 hidden sm:table-cell">سُلّمت</th>
              <th className="text-right py-2 px-2 hidden sm:table-cell">فشلت</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 && (
              <tr><td colSpan={7} className="py-6 text-center text-slate-500 text-xs">لا توجد حملات بعد</td></tr>
            )}
            {campaigns.map((c) => (
              <tr key={c.id} className="border-t border-white/5">
                <td className="py-2 px-2 truncate max-w-[160px]">{c.name}</td>
                <td className="py-2 px-2 text-slate-400">{c.channel}</td>
                <td className="py-2 px-2"><span className="text-xs px-2 py-0.5 rounded bg-white/5">{c.status}</span></td>
                <td className="py-2 px-2 hidden sm:table-cell tabular-nums">{c.audience_size}</td>
                <td className="py-2 px-2 tabular-nums">{c.sent_count}</td>
                <td className="py-2 px-2 hidden sm:table-cell tabular-nums text-emerald-300">{c.delivered_count}</td>
                <td className="py-2 px-2 hidden sm:table-cell tabular-nums text-red-300">{c.failed_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function ExportBtn({ rows, name }: { rows: ReadonlyArray<Record<string, unknown>> | ReadonlyArray<unknown>; name: string }) {
  const list = rows as ReadonlyArray<Record<string, unknown>>
  const onClick = () => {
    if (!list.length) return
    const headers = Object.keys(list[0]!)
    const csv = [
      headers.join(','),
      ...list.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${name}-${new Date().toISOString().slice(0,10)}.csv`
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-emerald-300">
      <Download className="h-3.5 w-3.5" /> CSV
    </button>
  )
}
