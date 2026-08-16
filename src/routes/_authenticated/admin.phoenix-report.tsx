import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useState } from 'react'
import {
  phoenixProbeKernel,
  phoenixProbeConnectivity,
  phoenixProbeSchema,
  phoenixProbeIndexes,
  phoenixProbeRls,
  phoenixProbeStorage,
  phoenixProbeFefo,
  phoenixProbeAi,
  phoenixProbeAuth,
  phoenixProbePerformance,
  phoenixProbeGoldenPath,
} from '@/lib/admin/phoenix.functions'
import { RouteLoadError } from '@/shared/components/RouteLoadError'

export const Route = createFileRoute('/_authenticated/admin/phoenix-report')({
  component: PhoenixReport,
  errorComponent: ({ error, reset }) => (
    <RouteLoadError title="تعذّر تحميل تقرير Phoenix" error={error} reset={reset} />
  ),
  notFoundComponent: () => <div className="p-6">الصفحة غير موجودة</div>,
})

type Status = 'idle' | 'running' | 'pass' | 'fail' | 'warn'
type Phase = {
  id: string
  title: string
  priority: 'P0' | 'P1' | 'P2'
  status: Status
  detail: unknown
  error?: string
  heals?: string[]
}

const WEIGHT: Record<Phase['priority'], number> = { P0: 25, P1: 10, P2: 5 }

const INITIAL: Phase[] = [
  { id: 'kernel', title: '٠ · النواة والبيئة', priority: 'P1', status: 'idle', detail: null },
  { id: 'conn', title: '١ · الاتصال بقاعدة البيانات', priority: 'P0', status: 'idle', detail: null },
  { id: 'schema', title: '٢ · سلامة الجداول', priority: 'P0', status: 'idle', detail: null },
  { id: 'indexes', title: '٣ · الفهارس والأداء', priority: 'P2', status: 'idle', detail: null },
  { id: 'rls', title: '٤ · RLS متعدد المستأجرين', priority: 'P0', status: 'idle', detail: null },
  { id: 'storage', title: '٥ · التخزين (Buckets)', priority: 'P1', status: 'idle', detail: null },
  { id: 'fefo', title: '٦ · منطق FEFO الذري', priority: 'P0', status: 'idle', detail: null },
  { id: 'ai', title: '٧ · محرك الذكاء الاصطناعي', priority: 'P1', status: 'idle', detail: null },
  { id: 'auth', title: '٨ · المصادقة و has_role', priority: 'P0', status: 'idle', detail: null },
  { id: 'perf', title: '٩ · الأداء والقياسات', priority: 'P2', status: 'idle', detail: null },
  { id: 'golden', title: '١٠ · المسار الذهبي E2E', priority: 'P1', status: 'idle', detail: null },
]

function Badge({ s }: { s: Status }) {
  const map: Record<Status, string> = {
    idle: 'bg-gray-200 text-gray-700',
    running: 'bg-blue-100 text-blue-700 animate-pulse',
    pass: 'bg-green-100 text-green-800',
    fail: 'bg-red-100 text-red-800',
    warn: 'bg-amber-100 text-amber-800',
  }
  const label: Record<Status, string> = {
    idle: '—',
    running: 'قيد التنفيذ',
    pass: '✅ ناجح',
    fail: '❌ فشل',
    warn: '⚠️ تحذير',
  }
  return <span className={`px-2 py-1 text-xs rounded font-medium ${map[s]}`}>{label[s]}</span>
}

function PhoenixReport() {
  const [phases, setPhases] = useState<Phase[]>(INITIAL)
  const [runAt, setRunAt] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const fns = {
    kernel: useServerFn(phoenixProbeKernel),
    conn: useServerFn(phoenixProbeConnectivity),
    schema: useServerFn(phoenixProbeSchema),
    indexes: useServerFn(phoenixProbeIndexes),
    rls: useServerFn(phoenixProbeRls),
    storage: useServerFn(phoenixProbeStorage),
    fefo: useServerFn(phoenixProbeFefo),
    ai: useServerFn(phoenixProbeAi),
    auth: useServerFn(phoenixProbeAuth),
    perf: useServerFn(phoenixProbePerformance),
    golden: useServerFn(phoenixProbeGoldenPath),
  }

  const patch = (id: string, p: Partial<Phase>) =>
    setPhases((prev) => prev.map((x) => (x.id === id ? { ...x, ...p } : x)))

  async function run<T>(id: string, fn: () => Promise<T>, judge: (r: T) => { status: Status; heals?: string[] }) {
    try {
      const r = await fn()
      const j = judge(r)
      patch(id, { status: j.status, detail: r, heals: j.heals })
    } catch (e) {
      patch(id, { status: 'fail', detail: null, error: String((e as Error).message ?? e) })
    }
  }

  async function runAll() {
    setBusy(true)
    setRunAt(new Date().toISOString())
    setPhases(INITIAL.map((p) => ({ ...p, status: 'running' })))

    await run('kernel', fns.kernel, (r) => ({
      status: r.env.SUPABASE_URL && r.env.SUPABASE_SERVICE_ROLE_KEY ? 'pass' : 'fail',
    }))
    await run('conn', fns.conn, (r) => ({
      status: r.admin.ok ? (r.admin.latencyMs < 1500 ? 'pass' : 'warn') : 'fail',
    }))
    await run('schema', fns.schema, (r) => {
      const bad = r.results.filter((x) => !x.exists || x.missingColumns.length)
      return {
        status: bad.length ? 'fail' : 'pass',
        heals: bad.map((b) => b.healSql).filter(Boolean) as string[],
      }
    })
    await run('indexes', fns.indexes, (r) => {
      const missing = r.results.filter((x) => !x.present)
      return {
        status: missing.length === 0 ? 'pass' : missing.length <= 2 ? 'warn' : 'fail',
        heals: missing.map((m) => m.healSql),
      }
    })
    await run('rls', fns.rls, (r) => {
      const pass =
        r.anonCatalogRead.ok &&
        r.authOwnOrdersRead.ok &&
        r.adminAllOrdersRead.ok &&
        r.crossUserWriteBlocked.ok
      return { status: pass ? 'pass' : 'fail' }
    })
    await run('storage', fns.storage, (r) => {
      const missing = r.status.filter((x) => !x.exists)
      return { status: missing.length === 0 ? 'pass' : 'warn' }
    })
    await run('fefo', fns.fefo, (r) => ({ status: r.rpcExists ? 'pass' : 'fail' }))
    await run('ai', fns.ai, (r) => ({
      status: r.dispatchOk ? 'pass' : r.agentExists ? 'warn' : 'fail',
    }))
    await run('auth', fns.auth, (r) => ({ status: r.hasRoleExists ? 'pass' : 'fail' }))
    await run('perf', fns.perf, (r) => ({ status: r.acceptable ? 'pass' : 'warn' }))
    await run('golden', fns.golden, (r) => ({
      status: r.catalogSearch.ok && r.ordersHistory.ok ? 'pass' : 'fail',
    }))

    setBusy(false)
  }

  useEffect(() => {
    void runAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Digital Immunity Score
  let score = 100
  for (const p of phases) {
    if (p.status === 'fail') score -= WEIGHT[p.priority]
    else if (p.status === 'warn') score -= Math.round(WEIGHT[p.priority] / 2)
  }
  score = Math.max(0, score)
  const scoreColor = score >= 90 ? 'text-green-700' : score >= 70 ? 'text-amber-700' : 'text-red-700'
  const readiness =
    score >= 90 ? '✅ Production-Grade' : score >= 70 ? '⚠️ Stable but Monitored' : '❌ Unstable'

  const allHeals = phases.flatMap((p) => (p.heals ?? []).map((h) => ({ phase: p.title, sql: h })))

  return (
    <div dir="rtl" className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🔱 Phoenix Protocol v7.0</h1>
          <p className="text-sm text-gray-600">
            آخر تشغيل: {runAt ? new Date(runAt).toLocaleString('ar') : '—'}
          </p>
          <p className="text-sm mt-1">{readiness}</p>
        </div>
        <div className="text-center">
          <div className={`text-6xl font-black ${scoreColor}`}>{score}</div>
          <div className="text-xs text-gray-500">Digital Immunity Score</div>
        </div>
      </header>

      <div className="flex gap-2">
        <button
          onClick={() => void runAll()}
          disabled={busy}
          className="px-4 py-2 bg-teal-600 text-white rounded disabled:opacity-50"
        >
          {busy ? 'جارٍ الفحص…' : 'إعادة الفحص الكامل'}
        </button>
      </div>

      <div className="grid gap-3">
        {phases.map((p) => (
          <details
            key={p.id}
            className="border rounded-lg bg-white overflow-hidden"
            open={p.status === 'fail' || p.status === 'warn'}
          >
            <summary className="p-4 cursor-pointer flex items-center justify-between hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold">{p.title}</span>
                <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">{p.priority}</span>
              </div>
              <Badge s={p.status} />
            </summary>
            <div className="border-t p-4 bg-gray-50 text-sm space-y-3">
              {p.error && (
                <div className="text-red-700 bg-red-50 p-2 rounded">
                  <b>خطأ:</b> {p.error}
                </div>
              )}
              {p.heals && p.heals.length > 0 && (
                <div>
                  <b className="text-amber-800">🛠️ إجراءات الإصلاح المقترحة (نسخ ولصق):</b>
                  <pre className="mt-2 whitespace-pre-wrap bg-amber-50 border border-amber-200 p-3 rounded text-xs font-mono">
                    {p.heals.join('\n\n')}
                  </pre>
                </div>
              )}
              {p.detail ? (
                <pre className="whitespace-pre-wrap break-all bg-white p-3 rounded border text-xs font-mono max-h-96 overflow-auto">
                  {JSON.stringify(p.detail, null, 2)}
                </pre>
              ) : (
                <div className="text-gray-500">لا توجد تفاصيل بعد.</div>
              )}
            </div>
          </details>
        ))}
      </div>

      {allHeals.length > 0 && (
        <section className="border rounded-lg p-4 bg-amber-50">
          <h2 className="font-bold mb-2">📋 قائمة كل التدخلات اليدوية المطلوبة</h2>
          <ol className="list-decimal pr-6 space-y-2 text-sm">
            {allHeals.map((h, i) => (
              <li key={i}>
                <div className="text-xs text-gray-600">{h.phase}</div>
                <pre className="whitespace-pre-wrap bg-white p-2 rounded border text-xs font-mono">
                  {h.sql}
                </pre>
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer className="text-xs text-gray-500 border-t pt-4 space-y-1">
        <div>القاعدة الحديدية: كل الفحوص للقراءة فقط. لن يُنفَّذ أي DDL تلقائيًا على الجداول الحسّاسة.</div>
        <div>الإصلاحات الحرجة تظهر أعلاه كأوامر SQL جاهزة للنسخ إلى محرر SQL بعد أخذ نسخة احتياطية.</div>
      </footer>
    </div>
  )
}
