import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { AlertTriangle, RefreshCw, Trash2, WifiOff, Bug, Shield, Server, Clock } from 'lucide-react'
import { toast } from 'sonner'
import type { ErrorKind } from '@/lib/errors/classify'

export const Route = createFileRoute('/_authenticated/admin-error-healer')({
  head: () => ({
    meta: [
      { title: 'مركز الأخطاء الذكي — Al-Musalli' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: ErrorHealerPage,
})

interface ErrorRow {
  id: string
  occurred_at: string
  level: string
  source: string
  message: string
  stack: string | null
  url: string | null
  user_agent: string | null
  user_id: string | null
  extra: Record<string, unknown> | null
}

const KIND_ICON: Record<string, React.ReactNode> = {
  network: <WifiOff className="h-4 w-4" />,
  server: <Server className="h-4 w-4" />,
  chunk: <RefreshCw className="h-4 w-4" />,
  auth: <Shield className="h-4 w-4" />,
  permission: <Shield className="h-4 w-4" />,
  rate_limit: <Clock className="h-4 w-4" />,
}

const KIND_LABEL_AR: Record<string, string> = {
  network: 'شبكة',
  auth: 'مصادقة',
  permission: 'صلاحيات',
  notfound: 'غير موجود',
  validation: 'تحقق',
  conflict: 'تعارض',
  rate_limit: 'حد المعدل',
  server: 'خادم',
  chunk: 'حزمة قديمة',
  unknown: 'غير معروف',
}

const KIND_COLOR: Record<string, string> = {
  network: 'bg-amber-100 text-amber-800',
  server: 'bg-rose-100 text-rose-800',
  chunk: 'bg-sky-100 text-sky-800',
  auth: 'bg-purple-100 text-purple-800',
  permission: 'bg-purple-100 text-purple-800',
  rate_limit: 'bg-orange-100 text-orange-800',
  validation: 'bg-indigo-100 text-indigo-800',
  conflict: 'bg-yellow-100 text-yellow-800',
  notfound: 'bg-gray-100 text-gray-700',
  unknown: 'bg-gray-100 text-gray-700',
}

function ErrorHealerPage() {
  const qc = useQueryClient()

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'error-logs'],
    queryFn: async (): Promise<ErrorRow[]> => {
      const { data, error } = await supabase
        .from('error_logs')
        .select('*')
        .order('occurred_at', { ascending: false })
        .limit(200)
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as ErrorRow[]
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  })

  const delOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('error_logs').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      toast.success('تم الحذف')
      void qc.invalidateQueries({ queryKey: ['admin', 'error-logs'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const clearOld = useMutation({
    mutationFn: async () => {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { error } = await supabase
        .from('error_logs')
        .delete()
        .lt('occurred_at', cutoff)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      toast.success('تم مسح السجلات الأقدم من 24 ساعة')
      void qc.invalidateQueries({ queryKey: ['admin', 'error-logs'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const rows = data ?? []

  // Aggregate by kind + message signature.
  const groups = aggregate(rows)
  const kindCounts = countBy(rows, (r) => extractKind(r))

  return (
    <div dir="rtl" className="mx-auto max-w-6xl space-y-6 p-4 pt-24 md:p-8 md:pt-24">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Bug className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black sm:text-2xl">مركز الأخطاء الذكي</h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              تجميع حي لأخطاء الواجهة والخادم مع معالجة مباشرة
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-white px-3 py-1.5 text-sm font-medium text-primary transition hover:bg-primary/5 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            تحديث
          </button>
          <button
            onClick={() => clearOld.mutate()}
            disabled={clearOld.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            مسح القديم
          </button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="الإجمالي" value={rows.length} tone="primary" />
        <StatCard label="شبكة" value={kindCounts.network ?? 0} tone="amber" />
        <StatCard label="خادم" value={kindCounts.server ?? 0} tone="rose" />
        <StatCard label="مصادقة" value={kindCounts.auth ?? 0} tone="purple" />
      </section>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">جاري التحميل…</div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center text-emerald-800">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8" />
          لا توجد أخطاء مسجّلة حاليًا — النظام بحالة صحية ✨
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <details
              key={g.key}
              className="group rounded-2xl border bg-white shadow-sm transition open:shadow-md"
            >
              <summary className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 sm:flex sm:flex-wrap sm:justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      KIND_COLOR[g.kind] ?? KIND_COLOR.unknown
                    }`}
                  >
                    {KIND_ICON[g.kind] ?? <AlertTriangle className="h-4 w-4" />}
                    {KIND_LABEL_AR[g.kind] ?? g.kind}
                  </span>
                  <span className="truncate text-sm font-medium text-gray-900">
                    {g.message}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 font-bold text-primary">
                    ×{g.count}
                  </span>
                  <span>{new Date(g.lastAt).toLocaleString('ar-EG')}</span>
                </div>
              </summary>

              <div className="border-t bg-slate-50/60 p-4 text-xs">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <ActionButton kind={g.kind} qc={qc} />
                  <button
                    onClick={() => g.ids.forEach((id) => delOne.mutate(id))}
                    className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-white px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    مسح المجموعة
                  </button>
                </div>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {g.samples.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-lg border bg-white p-2 font-mono text-[11px] leading-relaxed"
                    >
                      <div className="mb-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                        <span>🕒 {new Date(r.occurred_at).toLocaleString('ar-EG')}</span>
                        {r.url && <span>🔗 {r.url}</span>}
                        {r.user_agent && (
                          <span className="truncate">
                            📱 {shortenUA(r.user_agent)}
                          </span>
                        )}
                        {r.user_id && <span>👤 {r.user_id.slice(0, 8)}…</span>}
                      </div>
                      {r.stack && (
                        <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words text-[10px] text-slate-700">
                          {r.stack.slice(0, 800)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'primary' | 'amber' | 'rose' | 'purple'
}) {
  const map = {
    primary: 'bg-primary/10 text-primary',
    amber: 'bg-amber-100 text-amber-800',
    rose: 'bg-rose-100 text-rose-800',
    purple: 'bg-purple-100 text-purple-800',
  }
  return (
    <div className={`rounded-2xl p-4 ${map[tone]}`}>
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="text-2xl font-black">{value}</div>
    </div>
  )
}

function ActionButton({
  kind,
  qc,
}: {
  kind: ErrorKind
  qc: ReturnType<typeof useQueryClient>
}) {
  if (kind === 'chunk') {
    return (
      <button
        onClick={() => {
          if (typeof window !== 'undefined') window.location.reload()
        }}
        className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-2 py-1 text-xs text-white hover:bg-sky-700"
      >
        <RefreshCw className="h-3 w-3" />
        إعادة تحميل التطبيق
      </button>
    )
  }
  if (kind === 'network' || kind === 'server' || kind === 'rate_limit') {
    return (
      <button
        onClick={() => qc.invalidateQueries({ type: 'active' })}
        className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs text-white hover:bg-primary/90"
      >
        <RefreshCw className="h-3 w-3" />
        إعادة محاولة الاستعلامات
      </button>
    )
  }
  return null
}

function extractKind(r: ErrorRow): ErrorKind {
  const k = (r.extra?.kind as string | undefined) ?? 'unknown'
  return k as ErrorKind
}

function aggregate(rows: ErrorRow[]) {
  const map = new Map<
    string,
    {
      key: string
      kind: ErrorKind
      message: string
      count: number
      lastAt: string
      ids: string[]
      samples: ErrorRow[]
    }
  >()
  for (const r of rows) {
    const kind = extractKind(r)
    const key = `${kind}::${r.message}`
    const entry = map.get(key)
    if (entry) {
      entry.count++
      entry.ids.push(r.id)
      if (entry.samples.length < 5) entry.samples.push(r)
      if (r.occurred_at > entry.lastAt) entry.lastAt = r.occurred_at
    } else {
      map.set(key, {
        key,
        kind,
        message: r.message,
        count: 1,
        lastAt: r.occurred_at,
        ids: [r.id],
        samples: [r],
      })
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => b.count - a.count || (b.lastAt > a.lastAt ? 1 : -1),
  )
}

function countBy<T>(arr: T[], f: (x: T) => string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const x of arr) {
    const k = f(x)
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

function shortenUA(ua: string): string {
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS'
  if (/Android/.test(ua)) return 'Android'
  if (/Chrome/.test(ua)) return 'Chrome'
  if (/Safari/.test(ua)) return 'Safari'
  if (/Firefox/.test(ua)) return 'Firefox'
  return ua.slice(0, 40)
}
