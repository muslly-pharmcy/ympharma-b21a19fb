import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import {
  titanosProbeEnv,
  titanosCheckSchema,
  titanosCheckRls,
  titanosCheckFefo,
  titanosCheckAi,
} from '@/lib/admin/titanos.functions'
import { RouteLoadError } from '@/shared/components/RouteLoadError'

export const Route = createFileRoute('/_authenticated/admin/titanos-report')({
  component: TitanosReport,
  errorComponent: ({ error, reset }) => (
    <RouteLoadError title="تعذّر تحميل تقرير Titanos" error={error} reset={reset} />
  ),
  notFoundComponent: () => <div className="p-6">الصفحة غير موجودة</div>,
})

type Phase = {
  id: string
  title: string
  weight: number // 1=P2, 2=P1, 3=P0
  status: 'idle' | 'running' | 'pass' | 'fail' | 'warn'
  detail: unknown
  error?: string
}

const INITIAL: Phase[] = [
  { id: 'env', title: '٠ · البيئة والاتصال', weight: 3, status: 'idle', detail: null },
  { id: 'schema', title: '١ · سلامة الجداول', weight: 3, status: 'idle', detail: null },
  { id: 'rls', title: '٢ · سياسات RLS', weight: 3, status: 'idle', detail: null },
  { id: 'storage', title: '٣ · دورة Storage الكاملة', weight: 2, status: 'idle', detail: null },
  { id: 'fefo', title: '٤ · وجود دالة FEFO', weight: 3, status: 'idle', detail: null },
  { id: 'ai', title: '٥ · محرك الذكاء الاصطناعي', weight: 2, status: 'idle', detail: null },
]

function StatusBadge({ s }: { s: Phase['status'] }) {
  const map: Record<Phase['status'], string> = {
    idle: 'bg-gray-200 text-gray-700',
    running: 'bg-blue-100 text-blue-700 animate-pulse',
    pass: 'bg-green-100 text-green-800',
    fail: 'bg-red-100 text-red-800',
    warn: 'bg-amber-100 text-amber-800',
  }
  const label: Record<Phase['status'], string> = {
    idle: '—',
    running: 'قيد التنفيذ',
    pass: '✅ ناجح',
    fail: '❌ فشل',
    warn: '⚠️ تحذير',
  }
  return <span className={`px-2 py-1 text-xs rounded font-medium ${map[s]}`}>{label[s]}</span>
}

function TitanosReport() {
  const [phases, setPhases] = useState<Phase[]>(INITIAL)
  const [runAt, setRunAt] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const probeEnv = useServerFn(titanosProbeEnv)
  const checkSchema = useServerFn(titanosCheckSchema)
  const checkRls = useServerFn(titanosCheckRls)
  const checkFefo = useServerFn(titanosCheckFefo)
  const checkAi = useServerFn(titanosCheckAi)

  const update = (id: string, patch: Partial<Phase>) =>
    setPhases((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))

  async function runAll() {
    setBusy(true)
    setRunAt(new Date().toISOString())
    setPhases(INITIAL.map((p) => ({ ...p, status: 'running' })))

    // Phase 0
    try {
      const r = await probeEnv()
      const pass = r.connectivity.ok && r.env.SUPABASE_URL && r.env.SUPABASE_PUBLISHABLE_KEY
      update('env', { status: pass ? 'pass' : 'fail', detail: r })
    } catch (e) {
      update('env', { status: 'fail', detail: null, error: String((e as Error).message) })
    }

    // Phase 1
    try {
      const r = await checkSchema()
      const bad = r.results.filter((x) => !x.exists || x.missingColumns.length)
      update('schema', { status: bad.length ? 'fail' : 'pass', detail: r })
    } catch (e) {
      update('schema', { status: 'fail', detail: null, error: String((e as Error).message) })
    }

    // Phase 2
    try {
      const r = await checkRls()
      const pass = r.anonCatalogRead.ok && r.authOwnOrdersRead.ok && r.adminAllOrdersRead.ok
      update('rls', { status: pass ? 'pass' : 'fail', detail: r })
    } catch (e) {
      update('rls', { status: 'fail', detail: null, error: String((e as Error).message) })
    }

    // Phase 3 — client-side storage cycle
    try {
      const bucket = 'product-images'
      const path = `diagnostics/${Date.now()}-titanos.txt`
      const body = new Blob([`titanos @ ${new Date().toISOString()}`], { type: 'text/plain' })
      const steps: Array<{ step: string; ok: boolean; msg: string }> = []
      const up = await supabase.storage.from(bucket).upload(path, body, { upsert: true })
      steps.push({ step: 'upload', ok: !up.error, msg: up.error?.message ?? up.data?.path ?? '' })
      if (up.error) throw up.error
      const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60)
      steps.push({ step: 'sign', ok: !signed.error, msg: signed.error?.message ?? 'signed' })
      const dl = await supabase.storage.from(bucket).download(path)
      steps.push({ step: 'download', ok: !dl.error, msg: dl.error?.message ?? `${dl.data?.size ?? 0} bytes` })
      const del = await supabase.storage.from(bucket).remove([path])
      steps.push({ step: 'cleanup', ok: !del.error, msg: del.error?.message ?? 'removed' })
      const pass = steps.every((s) => s.ok)
      update('storage', { status: pass ? 'pass' : 'fail', detail: { steps } })
    } catch (e) {
      update('storage', { status: 'fail', detail: null, error: String((e as Error).message ?? e) })
    }

    // Phase 4
    try {
      const r = await checkFefo()
      update('fefo', { status: r.rpcExists ? 'pass' : 'fail', detail: r })
    } catch (e) {
      update('fefo', { status: 'fail', detail: null, error: String((e as Error).message) })
    }

    // Phase 5
    try {
      const r = await checkAi()
      const status: Phase['status'] = r.dispatchOk ? 'pass' : r.agentExists ? 'warn' : 'fail'
      update('ai', { status, detail: r })
    } catch (e) {
      update('ai', { status: 'fail', detail: null, error: String((e as Error).message) })
    }

    setBusy(false)
  }

  useEffect(() => {
    void runAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Health score
  const total = phases.reduce((sum, p) => sum + p.weight, 0)
  const earned = phases.reduce(
    (sum, p) => sum + (p.status === 'pass' ? p.weight : p.status === 'warn' ? p.weight * 0.5 : 0),
    0,
  )
  const score = Math.round((earned / total) * 100)
  const scoreColor = score >= 90 ? 'text-green-700' : score >= 60 ? 'text-amber-700' : 'text-red-700'

  return (
    <div dir="rtl" className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🔱 Titanos — تقرير الصحة</h1>
          <p className="text-sm text-gray-600">
            آخر تشغيل: {runAt ? new Date(runAt).toLocaleString('ar') : '—'}
          </p>
        </div>
        <div className="text-center">
          <div className={`text-5xl font-black ${scoreColor}`}>{score}</div>
          <div className="text-xs text-gray-500">درجة الصحة العامة</div>
        </div>
      </header>

      <div className="flex gap-2">
        <button
          onClick={() => void runAll()}
          disabled={busy}
          className="px-4 py-2 bg-teal-600 text-white rounded disabled:opacity-50"
        >
          {busy ? 'جارٍ التشغيل…' : 'إعادة الفحص الكامل'}
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
                <span className="text-xs text-gray-500">
                  {p.weight === 3 ? 'P0' : p.weight === 2 ? 'P1' : 'P2'}
                </span>
              </div>
              <StatusBadge s={p.status} />
            </summary>
            <div className="border-t p-4 bg-gray-50 text-sm">
              {p.error && (
                <div className="mb-2 text-red-700 bg-red-50 p-2 rounded">
                  <b>خطأ:</b> {p.error}
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

      <footer className="text-xs text-gray-500 border-t pt-4">
        كل الاختبارات للقراءة فقط. اختبار FEFO يستخدم مدخلات وهمية للتحقق من وجود الدالة دون تنفيذ طلب حقيقي.
      </footer>
    </div>
  )
}
