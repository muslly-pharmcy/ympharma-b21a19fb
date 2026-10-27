import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useMemo, useState } from 'react'
import { createPublicClient } from '@/lib/backend/client'
import { supabase } from '@/integrations/supabase/client'
import { getDiagnosticsActor, type DiagnosticsActor } from '@/lib/diagnostics.functions'
import { getServerBackendReadiness } from '@/lib/backend/readiness.functions'
import type { ServerBackendReadiness } from '@/lib/backend/server-credentials.server'
import {
  didRlsProbePass,
  type RlsProbeResult,
  type VisibilityExpectation,
} from '@/lib/admin/rls-diagnostics'
import { RouteLoadError } from '@/shared/components/RouteLoadError'

export const Route = createFileRoute('/_authenticated/admin-diagnostics')({
  component: DiagnosticsPage,
  errorComponent: ({ error, reset }) => (
    <RouteLoadError title="تعذّر تحميل صفحة التشخيص" error={error} reset={reset} />
  ),
  notFoundComponent: () => <div className="p-6">الصفحة غير موجودة</div>,
})

// ---------- Anon client (no session, publishable key only) ----------
const anonSupabase = new Proxy({} as ReturnType<typeof createPublicClient>, {
  get(_, prop) {
    const instance = createPublicClient()
    const value = Reflect.get(instance, prop)
    return typeof value === 'function' ? value.bind(instance) : value
  },
})

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
  const [backend, setBackend] = useState<ServerBackendReadiness | null>(null)
  const [backendBusy, setBackendBusy] = useState(false)
  const [backendError, setBackendError] = useState(false)

  const fetchActor = useServerFn(getDiagnosticsActor)
  const fetchBackend = useServerFn(getServerBackendReadiness)

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

  async function runBackendCheck() {
    setBackendBusy(true)
    setBackendError(false)
    try {
      setBackend(await fetchBackend())
    } catch {
      setBackend(null)
      setBackendError(true)
    } finally {
      setBackendBusy(false)
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
          يلزم دور مالك المؤسسة أو مسؤول النظام لتشغيل أدوات التشخيص.
        </p>
      </div>
    )
  }

  return (
    <div dir="rtl" className="p-6 max-w-5xl mx-auto space-y-8">
      <header>
        <h1 className="text-2xl font-bold">تشخيص Supabase (Admin)</h1>
        <p className="text-sm text-gray-600">
          يفحص صلاحيات الوصول وربط الخادم وحاويات صور المنتجات. الفحوصات للقراءة فقط.
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

      <section className="border rounded-lg p-4 bg-white space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">٣) ربط الخادم وصور المنتجات</h2>
          <button
            className="px-3 py-1.5 bg-teal-600 text-white rounded disabled:opacity-50"
            onClick={() => void runBackendCheck()}
            disabled={backendBusy}
          >
            {backendBusy ? 'جارٍ الفحص…' : 'فحص الربط'}
          </button>
        </div>
        <p className="text-sm text-gray-600">يتحقق الخادم من المفتاح دون إرساله إلى المتصفح أو إنشاء ملفات تجريبية.</p>
        {backendError && <p role="alert" className="text-red-700">تعذّر الفحص. تحقق من الجلسة والصلاحيات ثم أعد المحاولة.</p>}
        {backend && (
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt>المشروع المختار</dt><dd className="font-mono break-all">{backend.projectId}</dd>
            <dt>إعداد المفتاح</dt><dd>{credentialMessages[backend.configuration.issue]}</dd>
            <dt>التحقق من الاتصال</dt><dd>{connectionMessages[backend.connection]}</dd>
            <dt><code>product-images</code></dt><dd>{bucketMessages[backend.productImages]}</dd>
            <dt><code>catalog-media</code></dt><dd>{bucketMessages[backend.catalogMedia]}</dd>
          </dl>
        )}
        <details className="text-sm">
          <summary className="cursor-pointer text-teal-700">إعداد Secrets الآمن</summary>
          <div className="mt-3 space-y-2">
            <p>من <a className="underline" href="https://supabase.com/dashboard/project/ybhrmcdlgyccywpmiucz/settings/api-keys" target="_blank" rel="noreferrer">مفاتيح مشروع Supabase المختار</a>، استخدم مفتاح الخادم لهذا المشروع.</p>
            <p>أضف القيم في <a className="underline" href="https://lovable.dev/projects/4d4aad01-9bf4-4d8b-acab-e51a06a17c63" target="_blank" rel="noreferrer">Lovable</a> ← Cloud ← Secrets، ثم أعد النشر:</p>
            <ul className="list-disc pr-5 space-y-1">
              <li><code>MUSLLY_SUPABASE_PROJECT_ID</code>: <code>ybhrmcdlgyccywpmiucz</code></li>
              <li><code>MUSLLY_SUPABASE_SERVICE_ROLE_KEY</code>: مفتاح <code>sb_secret_…</code> أو مفتاح <code>service_role</code> الخاص بالمشروع نفسه.</li>
            </ul>
            <p>ضع المفتاح في مخزن Secrets فقط. لا تضعه في المحادثة أو GitHub أو أي متغير يبدأ بـ <code>VITE_</code>.</p>
            <p>ينشئ أول رفع مصرح به حاوية صور المنتجات الخاصة عند غيابها. ظهور حاوية عامة يستدعي مراجعة إعدادها قبل استخدامها.</p>
          </div>
        </details>
      </section>
    </div>
  )
}

const credentialMessages: Record<ServerBackendReadiness['configuration']['issue'], string> = {
  missing: 'لم يُضف مفتاح الخادم بعد',
  missing_project_binding: 'يلزم إضافة معرّف المشروع مع المفتاح',
  project_mismatch: 'المفتاح أو إعداد المشروع يشير إلى مشروع مختلف',
  invalid_format: 'القيمة ليست مفتاح خادم صالح الصيغة',
  configured: 'الإعداد موجود؛ نتيجة الاتصال تؤكد صلاحيته',
}
const connectionMessages: Record<ServerBackendReadiness['connection'], string> = {
  not_checked: 'لم يُفحص بسبب نقص الإعداد',
  verified: 'نجح التحقق من Supabase',
  rejected: 'رفض Supabase المفتاح أو الصلاحية',
  unavailable: 'تعذّر الاتصال؛ أعد المحاولة',
}
const bucketMessages: Record<ServerBackendReadiness['productImages'], string> = {
  not_checked: 'لم تُفحص', missing: 'غير موجودة', private: 'خاصة', public: 'عامة — تحتاج مراجعة',
}
