import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import { getDiagnosticsActor, type DiagnosticsActor } from '@/lib/diagnostics.functions'
import {
  didRlsProbePass,
  type RlsProbeResult,
  type VisibilityExpectation,
} from '@/lib/admin/rls-diagnostics'
import { RouteLoadError } from '@/shared/components/RouteLoadError'
import type { Database } from '@/integrations/supabase/types'

export const Route = createFileRoute('/_authenticated/admin-diagnostics')({
  component: DiagnosticsPage,
  errorComponent: ({ error, reset }) => (
    <RouteLoadError title="تعذّر تحميل صفحة التشخيص" error={error} reset={reset} />
  ),
  notFoundComponent: () => <div className="p-6">الصفحة غير موجودة</div>,
})

// ---------- Anon client (no session, publishable key only) ----------
const anonSupabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
  { auth: { persistSession: false, autoRefreshToken: false, storage: undefined } },
)

type Row = {
  name: string
  anonOk: boolean
  anonMsg: string
  authOk: boolean
  authMsg: string
  expect: VisibilityExpectation
  passed: boolean
}

interface DynamicTableClient {
  from: (name: string) => {
    select: (
      columns: string,
      options: { head: true; count: 'exact' },
    ) => { limit: (count: number) => PromiseLike<RlsProbeResult> }
  }
}

const RLS_TABLES: Array<{ name: string; columns: string; expect: VisibilityExpectation }> = [
  // catalog_products deliberately grants anon access to a safe column list,
  // so select('*') is expected to fail even when the storefront grant is correct.
  { name: 'catalog_products', columns: 'id,name_ar,status,is_public', expect: 'anon-readable' },
  { name: 'catalog_categories', columns: 'id', expect: 'anon-readable' },
  { name: 'hc_patients', columns: 'id', expect: 'anon-hidden' },
  { name: 'orders', columns: 'id', expect: 'anon-hidden' },
  { name: 'user_roles', columns: 'id', expect: 'anon-hidden' },
  { name: 'organization_members', columns: 'id', expect: 'anon-hidden' },
]

function DiagnosticsPage() {
  const [actor, setActor] = useState<DiagnosticsActor | null>(null)
  const [actorErr, setActorErr] = useState<string | null>(null)
  const [rlsRows, setRlsRows] = useState<Row[]>([])
  const [rlsBusy, setRlsBusy] = useState(false)
  const [storageLog, setStorageLog] = useState<Array<{ step: string; ok: boolean; msg: string }>>([])
  const [storageBusy, setStorageBusy] = useState(false)

  const fetchActor = useServerFn(getDiagnosticsActor)

  useEffect(() => {
    fetchActor()
      .then(setActor)
      .catch((e) => setActorErr(String(e?.message ?? e)))
  }, [fetchActor])

  const isAdmin = useMemo(
    () => !!actor && (actor.roles.includes('admin') || actor.roles.includes('superadmin') || actor.orgRole === 'owner'),
    [actor],
  )

  async function runRlsTests() {
    setRlsBusy(true)
    setRlsRows([])
    const results: Row[] = []
    for (const t of RLS_TABLES) {
      const anonDynamic = anonSupabase as unknown as DynamicTableClient
      const authDynamic = supabase as unknown as DynamicTableClient
      const [anonRes, authRes] = await Promise.all([
        anonDynamic.from(t.name).select(t.columns, { head: true, count: 'exact' }).limit(1),
        authDynamic.from(t.name).select(t.columns, { head: true, count: 'exact' }).limit(1),
      ])
      results.push({
        name: t.name,
        expect: t.expect,
        anonOk: !anonRes.error,
        anonMsg: anonRes.error ? anonRes.error.message : `count=${anonRes.count ?? 0}`,
        authOk: !authRes.error,
        authMsg: authRes.error ? authRes.error.message : `count=${authRes.count ?? 0}`,
        passed: didRlsProbePass(t.expect, anonRes, authRes),
      })
      setRlsRows([...results])
    }
    setRlsBusy(false)
  }

  async function runStorageTest() {
    setStorageBusy(true)
    setStorageLog([])
    const log: typeof storageLog = []
    const push = (step: string, ok: boolean, msg: string) => {
      log.push({ step, ok, msg })
      setStorageLog([...log])
    }

    const bucket = 'product-images'
    const path = `diagnostics/${Date.now()}-test.txt`
    const body = new Blob([`diagnostic upload @ ${new Date().toISOString()}`], { type: 'text/plain' })

    try {
      const up = await supabase.storage.from(bucket).upload(path, body, { upsert: true, contentType: 'text/plain' })
      if (up.error) return push('upload', false, up.error.message)
      push('upload', true, `path=${up.data.path}`)

      const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60)
      if (signed.error) push('sign', false, signed.error.message)
      else push('sign', true, signed.data.signedUrl.slice(0, 80) + '…')

      const dl = await supabase.storage.from(bucket).download(path)
      if (dl.error) push('download', false, dl.error.message)
      else push('download', true, `bytes=${dl.data.size}`)

      const del = await supabase.storage.from(bucket).remove([path])
      if (del.error) push('cleanup', false, del.error.message)
      else push('cleanup', true, 'removed')
    } catch (e) {
      push('exception', false, String((e as Error)?.message ?? e))
    } finally {
      setStorageBusy(false)
    }
  }

  if (actorErr) {
    return (
      <div dir="rtl" className="p-6 max-w-3xl mx-auto">
        <h1 className="text-xl font-bold">تشخيص Supabase</h1>
        <p className="mt-3 text-red-700 bg-red-50 p-3 rounded">
          فشل الاتصال بالسيرفر: {actorErr}
        </p>
      </div>
    )
  }
  if (!actor) return <div dir="rtl" className="p-6">جارٍ التحميل…</div>

  if (!isAdmin) {
    return (
      <div dir="rtl" className="p-6 max-w-3xl mx-auto">
        <h1 className="text-xl font-bold">تشخيص Supabase</h1>
        <p className="mt-3 text-amber-800 bg-amber-50 p-3 rounded">
          هذه الصفحة للأدمن فقط. دورك الحالي: <b>{actor.orgRole}</b> — الأدوار: {actor.roles.join(', ') || '—'}.
          <br />
          إذا رأيت هذه الرسالة فالـ RLS يعمل: الميدلوير سمح بالوصول للسيرفر فن، والواجهة تمنع الأدوات لأن دورك ليس أدمن.
        </p>
      </div>
    )
  }

  return (
    <div dir="rtl" className="p-6 max-w-5xl mx-auto space-y-8">
      <header>
        <h1 className="text-2xl font-bold">تشخيص Supabase (Admin)</h1>
        <p className="text-sm text-gray-600">
          يفحص RLS كـ anon مقابل authenticated، ورفع/تنزيل ملف Storage، وحالة الميدلوير.
        </p>
      </header>

      {/* --- Actor / middleware --- */}
      <section className="border rounded-lg p-4 bg-white">
        <h2 className="font-semibold mb-2">١) الميدلوير والدور</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-gray-500">User ID</dt><dd className="font-mono">{actor.userId}</dd>
          <dt className="text-gray-500">Org</dt><dd className="font-mono">{actor.organizationId}</dd>
          <dt className="text-gray-500">Org role</dt><dd>{actor.orgRole}</dd>
          <dt className="text-gray-500">App roles</dt><dd>{actor.roles.join(', ') || '—'}</dd>
          <dt className="text-gray-500">IP</dt><dd className="font-mono">{actor.ip ?? '—'}</dd>
        </dl>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-teal-700">صلاحيات ({actor.permissions.length})</summary>
          <div className="mt-2 flex flex-wrap gap-1">
            {actor.permissions.map((p) => (
              <span key={p} className="px-2 py-0.5 text-xs bg-gray-100 rounded">{p}</span>
            ))}
          </div>
        </details>
      </section>

      {/* --- RLS --- */}
      <section className="border rounded-lg p-4 bg-white">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">٢) اختبار RLS (anon مقابل authenticated)</h2>
          <button
            className="px-3 py-1.5 bg-teal-600 text-white rounded disabled:opacity-50"
            onClick={() => void runRlsTests()}
            disabled={rlsBusy}
          >
            {rlsBusy ? 'جارٍ الفحص…' : 'تشغيل الفحص'}
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-right border-b">
              <th className="p-2">الجدول</th>
              <th className="p-2">المتوقع</th>
              <th className="p-2">Anon</th>
              <th className="p-2">Authenticated</th>
              <th className="p-2">الحكم</th>
            </tr>
          </thead>
          <tbody>
            {rlsRows.map((r) => {
              return (
                <tr key={r.name} className="border-b">
                  <td className="p-2 font-mono">{r.name}</td>
                  <td className="p-2">{r.expect === 'anon-readable' ? 'قراءة آمنة مسموحة' : 'صفر صفوف أو رفض'}</td>
                  <td className={`p-2 ${r.anonOk ? 'text-green-700' : 'text-red-700'}`}>{r.anonMsg}</td>
                  <td className={`p-2 ${r.authOk ? 'text-green-700' : 'text-red-700'}`}>{r.authMsg}</td>
                  <td className="p-2">{r.passed ? '✅' : '❌'}</td>
                </tr>
              )
            })}
            {!rlsRows.length && !rlsBusy && (
              <tr><td colSpan={5} className="p-3 text-gray-500">لا توجد نتائج بعد.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {/* --- Storage --- */}
      <section className="border rounded-lg p-4 bg-white">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">٣) اختبار Storage — bucket <code>product-images</code></h2>
          <button
            className="px-3 py-1.5 bg-teal-600 text-white rounded disabled:opacity-50"
            onClick={() => void runStorageTest()}
            disabled={storageBusy}
          >
            {storageBusy ? 'جارٍ التنفيذ…' : 'تشغيل الاختبار'}
          </button>
        </div>
        <ul className="space-y-1 text-sm">
          {storageLog.map((s, i) => (
            <li key={i} className={s.ok ? 'text-green-700' : 'text-red-700'}>
              {s.ok ? '✅' : '❌'} <b>{s.step}</b>: {s.msg}
            </li>
          ))}
          {!storageLog.length && !storageBusy && (
            <li className="text-gray-500">اضغط "تشغيل الاختبار" لرفع ملف تجريبي، توقيع URL، تنزيله، ثم حذفه.</li>
          )}
        </ul>
      </section>
    </div>
  )
}
