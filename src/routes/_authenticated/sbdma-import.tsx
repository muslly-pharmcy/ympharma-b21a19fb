import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FileUp,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  Loader2,
  History,
} from 'lucide-react'
import {
  analyzeSbdmaImport,
  commitSbdmaImport,
  listSbdmaImportJobs,
  getSbdmaImportJob,
  type SbdmaInputRow,
  type ImportDecision,
} from '@/lib/sbdma-import.functions'

export const Route = createFileRoute('/_authenticated/sbdma-import')({
  head: () => ({
    meta: [
      { title: 'استيراد أسعار SBDMA — MUSLLY AI OS' },
      {
        name: 'description',
        content:
          'محرك استيراد أسعار الهيئة العليا للأدوية بمنطق قرار: تطابق، جديد، غامض، غير صالح.',
      },
    ],
  }),
  component: SbdmaImportPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-red-600">فشل تحميل الصفحة: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-center">غير موجود</div>,
})

const SAMPLE = `[
  {
    "barcode": "6221234567890",
    "name_ar": "باراسيتامول 500",
    "manufacturer": "GSK",
    "manufacturer_country": "UK",
    "agent_name": "Pharma Care",
    "sbdma_official_price": 250,
    "requires_prescription": false
  }
]`

function SbdmaImportPage() {
  const [source, setSource] = useState('sbdma-upload-' + new Date().toISOString().slice(0, 10))
  const [json, setJson] = useState(SAMPLE)
  const [parseError, setParseError] = useState<string | null>(null)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const qc = useQueryClient()

  const jobs = useQuery({
    queryKey: ['sbdma-jobs'],
    queryFn: () => listSbdmaImportJobs(),
  })

  const jobDetail = useQuery({
    queryKey: ['sbdma-job', activeJobId],
    queryFn: () => getSbdmaImportJob({ data: { job_id: activeJobId! } }),
    enabled: !!activeJobId,
  })

  const analyze = useMutation({
    mutationFn: async () => {
      let rows: SbdmaInputRow[]
      try {
        const parsed = JSON.parse(json)
        if (!Array.isArray(parsed)) throw new Error('JSON must be an array')
        rows = parsed as SbdmaInputRow[]
      } catch (e) {
        const parseError = new Error(
          `JSON غير صالح: ${e instanceof Error ? e.message : String(e)}`,
        ) as Error & { cause?: unknown }
        parseError.cause = e
        throw parseError
      }
      return analyzeSbdmaImport({ data: { source_name: source, rows } })
    },
    onSuccess: (r) => {
      setActiveJobId(r.job_id)
      setParseError(null)
      qc.invalidateQueries({ queryKey: ['sbdma-jobs'] })
    },
    onError: (e) => setParseError(e instanceof Error ? e.message : String(e)),
  })

  const commit = useMutation({
    mutationFn: async (job_id: string) => commitSbdmaImport({ data: { job_id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sbdma-jobs'] })
      qc.invalidateQueries({ queryKey: ['sbdma-job', activeJobId] })
    },
  })

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6" dir="rtl">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Sparkles className="h-8 w-8 text-teal-600" />
          استيراد أسعار الهيئة (SBDMA)
        </h1>
        <p className="text-sm text-muted-foreground">
          محرك قرار بمرحلتين: <span className="font-semibold">تحليل (Dry Run)</span> ثم{' '}
          <span className="font-semibold">تطبيق</span>. المطابقة بالباركود أولاً، ثم بالاسم +
          الشركة. الغامض والمرفوض يحتاج مراجعة يدوية.
        </p>
      </header>

      {/* Upload form */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <FileUp className="h-5 w-5" /> رفع دفعة جديدة (JSON)
        </h2>
        <div className="grid gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              اسم المصدر
            </span>
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              الصفوف (JSON Array)
            </span>
            <textarea
              value={json}
              onChange={(e) => setJson(e.target.value)}
              rows={10}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs"
              dir="ltr"
            />
          </label>
          {parseError && (
            <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{parseError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => analyze.mutate()}
              disabled={analyze.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {analyze.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              تحليل (Dry Run)
            </button>
          </div>
        </div>
      </section>

      {/* Job detail */}
      {jobDetail.data && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">
                نتائج الدفعة:{' '}
                <span className="font-mono text-xs text-muted-foreground">
                  {jobDetail.data.summary.id.slice(0, 8)}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                الحالة: {jobDetail.data.summary.status} • المصدر:{' '}
                {jobDetail.data.summary.source_name}
              </p>
            </div>
            {jobDetail.data.summary.status === 'analyzed' && (
              <button
                onClick={() => commit.mutate(jobDetail.data!.summary.id)}
                disabled={commit.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {commit.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                تطبيق (Commit)
              </button>
            )}
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard label="الإجمالي" value={jobDetail.data.summary.total_rows} tone="default" />
            <StatCard
              label="تطابق"
              value={jobDetail.data.summary.matched_count}
              tone="success"
            />
            <StatCard label="جديد" value={jobDetail.data.summary.new_count} tone="info" />
            <StatCard
              label="غامض"
              value={jobDetail.data.summary.ambiguous_count}
              tone="warn"
            />
            <StatCard
              label="مرفوض"
              value={jobDetail.data.summary.invalid_count}
              tone="danger"
            />
          </div>

          {commit.isError && (
            <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">
              فشل التطبيق: {(commit.error as Error).message}
            </p>
          )}
          {jobDetail.data.summary.error && (
            <details className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
              <summary className="cursor-pointer font-semibold">أخطاء التطبيق</summary>
              <pre className="mt-1 whitespace-pre-wrap">{jobDetail.data.summary.error}</pre>
            </details>
          )}

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 text-right">#</th>
                  <th className="p-2 text-right">القرار</th>
                  <th className="p-2 text-right">الاسم</th>
                  <th className="p-2 text-right">الباركود</th>
                  <th className="p-2 text-right">السعر</th>
                  <th className="p-2 text-right">الثقة</th>
                  <th className="p-2 text-right">السبب</th>
                  <th className="p-2 text-right">مطبّق؟</th>
                </tr>
              </thead>
              <tbody>
                {jobDetail.data.rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-2 tabular-nums">{r.row_index + 1}</td>
                    <td className="p-2">
                      <DecisionBadge d={r.decision} />
                    </td>
                    <td className="p-2 truncate max-w-[220px]">{r.payload.name_ar ?? '—'}</td>
                    <td className="p-2 font-mono text-xs">{r.payload.barcode ?? '—'}</td>
                    <td className="p-2 tabular-nums">
                      {r.payload.sbdma_official_price ?? '—'}
                    </td>
                    <td className="p-2 tabular-nums">
                      {r.confidence != null ? r.confidence.toFixed(2) : '—'}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">{r.reason ?? '—'}</td>
                    <td className="p-2">
                      {r.applied ? (
                        <span className="text-emerald-600">✓</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Job history */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <History className="h-5 w-5" /> سجل الدفعات الأخيرة
        </h2>
        {jobs.isLoading ? (
          <p className="text-sm text-muted-foreground">جاري التحميل…</p>
        ) : (jobs.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد دفعات بعد.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 text-right">التاريخ</th>
                  <th className="p-2 text-right">المصدر</th>
                  <th className="p-2 text-right">الحالة</th>
                  <th className="p-2 text-right">الإجمالي</th>
                  <th className="p-2 text-right">تطابق</th>
                  <th className="p-2 text-right">جديد</th>
                  <th className="p-2 text-right">غامض</th>
                  <th className="p-2 text-right">مرفوض</th>
                  <th className="p-2 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {jobs.data!.map((j) => (
                  <tr key={j.id} className="border-t border-border">
                    <td className="p-2 text-xs">
                      {new Date(j.created_at).toLocaleString('ar-EG')}
                    </td>
                    <td className="p-2">{j.source_name}</td>
                    <td className="p-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {j.status}
                      </span>
                    </td>
                    <td className="p-2 tabular-nums">{j.total_rows}</td>
                    <td className="p-2 tabular-nums text-emerald-700">{j.matched_count}</td>
                    <td className="p-2 tabular-nums text-blue-700">{j.new_count}</td>
                    <td className="p-2 tabular-nums text-amber-700">{j.ambiguous_count}</td>
                    <td className="p-2 tabular-nums text-red-700">{j.invalid_count}</td>
                    <td className="p-2">
                      <button
                        onClick={() => setActiveJobId(j.id)}
                        className="text-xs text-teal-700 hover:underline"
                      >
                        عرض
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function DecisionBadge({ d }: { d: ImportDecision }) {
  const map = {
    matched: { cls: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2, label: 'تطابق' },
    new: { cls: 'bg-blue-100 text-blue-800', icon: Sparkles, label: 'جديد' },
    ambiguous: { cls: 'bg-amber-100 text-amber-800', icon: AlertTriangle, label: 'غامض' },
    invalid: { cls: 'bg-red-100 text-red-800', icon: XCircle, label: 'مرفوض' },
  }[d]
  const Icon = map.icon
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${map.cls}`}
    >
      <Icon className="h-3 w-3" />
      {map.label}
    </span>
  )
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'default' | 'success' | 'info' | 'warn' | 'danger'
}) {
  const toneCls = {
    default: 'bg-muted text-foreground',
    success: 'bg-emerald-50 text-emerald-800',
    info: 'bg-blue-50 text-blue-800',
    warn: 'bg-amber-50 text-amber-800',
    danger: 'bg-red-50 text-red-800',
  }[tone]
  return (
    <div className={`rounded-xl p-3 ${toneCls}`}>
      <div className="text-xs">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
    </div>
  )
}
