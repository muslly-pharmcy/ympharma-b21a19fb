import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useRef, useState } from 'react'
import { Image as ImageIcon, Loader2, Search, Sparkles, StopCircle } from 'lucide-react'
import { toast } from 'sonner'
import { getImageQueueStats } from '@/lib/excel-import.functions'
import { generateProductImages } from '@/lib/ai/product-imagery.functions'
import {
  fetchProductImagesFromGoogle,
  getGoogleImageProgress,
  type ImageSearchResult,
} from '@/lib/ai/product-image-search.functions'

export const Route = createFileRoute('/_authenticated/admin-image-queue')({
  head: () => ({
    meta: [{ title: 'طابور توليد صور المنتجات — لوحة التحكم' }],
  }),
  component: AdminImageQueue,
  errorComponent: ({ error }) => (
    <div className="p-8 text-red-600" dir="rtl">فشل: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8" dir="rtl">غير موجود</div>,
})

const BATCH_SIZE = 8
const MAX_BATCHES = 40

function AdminImageQueue() {
  const qc = useQueryClient()
  const genFn = useServerFn(generateProductImages)
  const googleFn = useServerFn(fetchProductImagesFromGoogle)
  const progressFn = useServerFn(getGoogleImageProgress)

  const [running, setRunning] = useState(false)
  const [force, setForce] = useState(false)
  const [done, setDone] = useState(0)
  const [target, setTarget] = useState(0)
  const [summary, setSummary] = useState<{
    updated: number
    skipped: number
    reasons: { quota: number; noImage: number; stopped: number; error: number }
    results: ImageSearchResult[]
  } | null>(null)

  const stopRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  const googleProgress = useQuery({
    queryKey: ['admin', 'google-image-progress'],
    queryFn: () => progressFn(),
  })

  async function runGoogleUpdate() {
    stopRef.current = false
    abortRef.current = new AbortController()
    setRunning(true)
    setDone(0)
    setSummary(null)

    const missing = googleProgress.data?.missing ?? 0
    const totalTarget = force ? googleProgress.data?.total ?? 0 : missing
    const planned = Math.min(totalTarget, BATCH_SIZE * MAX_BATCHES)
    setTarget(planned)

    let updated = 0
    let skipped = 0
    const all: ImageSearchResult[] = []

    try {
      for (let i = 0; i < MAX_BATCHES; i += 1) {
        if (stopRef.current) break
        const r = await googleFn({
          data: { batchSize: BATCH_SIZE, force },
          signal: abortRef.current.signal,
        })
        updated += r.updated
        skipped += r.skipped
        all.push(...r.results)
        setDone((d) => d + r.processed)
        if (r.processed === 0) break
        if (!force && r.remaining === 0) break
      }
      setSummary({ updated, skipped, results: all })
      if (stopRef.current) toast.info(`تم الإيقاف: حُدِّثت ${updated} صورة`)
      else toast.success(`اكتمل: تم تحديث ${updated} صورة، وتخطّي ${skipped}`)
      void qc.invalidateQueries({ queryKey: ['admin', 'google-image-progress'] })
    } catch (e) {
      const aborted =
        stopRef.current || (e as Error)?.name === 'AbortError' || abortRef.current?.signal.aborted
      setSummary({ updated, skipped, results: all })
      if (aborted) {
        toast.info(`تم الإيقاف: حُدِّثت ${updated} صورة`)
        void qc.invalidateQueries({ queryKey: ['admin', 'google-image-progress'] })
      } else {
        toast.error((e as Error).message)
      }
    } finally {
      abortRef.current = null
      setRunning(false)
    }
  }


  const gen = useMutation({
    mutationFn: () => genFn({ data: { limit: 3 } }),
    onSuccess: (r) => {
      toast.success(`تم توليد ${r.generated} صورة (تم تخطي ${r.skipped})`)
      void qc.invalidateQueries({ queryKey: ['admin', 'image-queue'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const q = useQuery({
    queryKey: ['admin', 'image-queue'],
    queryFn: () => getImageQueueStats(),
    refetchInterval: 15_000,
  })


  return (
    <div dir="rtl" className="mx-auto max-w-4xl space-y-6 p-6 pt-24">
      <header className="flex items-center gap-3">
        <ImageIcon className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">طابور توليد صور المنتجات</h1>
          <p className="text-sm text-gray-600">
            حالة معالجة صور الكتالوج. سيقوم العمّال الخلفيون بتحديث المنتجات تلقائياً.
          </p>
        </div>
      </header>

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">صور جوجل الحقيقية</h2>
            <p className="text-sm text-gray-600">
              {googleProgress.data
                ? `${googleProgress.data.withImage.toLocaleString('ar-EG')} من ${googleProgress.data.total.toLocaleString('ar-EG')} منتج لديه صورة — ينقص ${googleProgress.data.missing.toLocaleString('ar-EG')}`
                : 'جارٍ حساب الحالة…'}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
              disabled={running}
              className="h-4 w-4 accent-[var(--color-primary,#0f766e)]"
            />
            إعادة تحديث الصور الموجودة
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => void runGoogleUpdate()}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            تحديث صور المنتجات من جوجل
          </button>
          {running && (
            <button
              onClick={() => {
                stopRef.current = true
                abortRef.current?.abort()
              }}

              className="inline-flex items-center gap-2 rounded-2xl border border-gray-300 px-5 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50"
            >
              <StopCircle className="h-4 w-4" /> إيقاف
            </button>
          )}
        </div>

        {running && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-800">
              جارٍ التحديث {done.toLocaleString('ar-EG')}/{Math.max(target, done).toLocaleString('ar-EG')}…
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${target ? Math.min(100, (done / target) * 100) : 5}%` }}
              />
            </div>
          </div>
        )}

        {summary && (
          <div className="space-y-3 rounded-xl bg-gray-50 p-4">
            <p className="text-sm font-bold text-gray-900">
              التقرير النهائي: تم تحديث {summary.updated.toLocaleString('ar-EG')} — تم تخطّي{' '}
              {summary.skipped.toLocaleString('ar-EG')}
            </p>
            {summary.results.filter((r) => !r.ok).length > 0 && (
              <ul className="max-h-56 space-y-1 overflow-auto text-xs text-gray-600">
                {summary.results
                  .filter((r) => !r.ok)
                  .slice(0, 100)
                  .map((r) => (
                    <li key={r.productId} className="flex justify-between gap-3">
                      <span className="truncate">{r.name}</span>
                      <span className="shrink-0 text-gray-400">{r.reason}</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <button
        onClick={() => gen.mutate()}
        disabled={gen.isPending}
        className="inline-flex items-center gap-2 rounded-2xl border border-gray-300 px-5 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {gen.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        توليد صور احترافية بالذكاء الاصطناعي (3 منتجات)
      </button>


      {q.isLoading ? (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> جارٍ التحميل…
        </div>
      ) : q.data ? (
        <>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-gray-500">إجمالي المنتجات في الطابور</p>
            <p className="mt-2 text-4xl font-black text-primary">
              {q.data.total.toLocaleString('ar-EG')}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Object.entries(q.data.by_status).map(([status, count]) => (
              <div
                key={status}
                className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm"
              >
                <p className="text-xs uppercase tracking-wider text-gray-500">{status}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {count.toLocaleString('ar-EG')}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            يتم التحديث تلقائياً كل 15 ثانية.
          </p>
        </>
      ) : null}
    </div>
  )
}
