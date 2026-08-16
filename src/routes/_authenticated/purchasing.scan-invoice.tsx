import { createFileRoute } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { Camera, FileCheck2, Loader2, ScanLine } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { analyzeInvoiceImage, createVisionUploadUrl } from '@/lib/vision.functions'
import {
  createDraftPoFromInvoice,
  listInvoiceJobRows,
} from '@/lib/invoice-intake.functions'
import { listSuppliers } from '@/lib/suppliers.functions'
import { listWarehouses } from '@/lib/inventory.functions'

export const Route = createFileRoute('/_authenticated/purchasing/scan-invoice')({
  head: () => ({
    meta: [
      { title: 'مسح فاتورة المورد — صيدلية المصلي' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: ScanInvoicePage,
})

function ScanInvoicePage() {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [supplierId, setSupplierId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')

  const uploadFn = useServerFn(createVisionUploadUrl)
  const analyzeFn = useServerFn(analyzeInvoiceImage)
  const draftFn = useServerFn(createDraftPoFromInvoice)

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers', 'active'],
    queryFn: () => listSuppliers(),
  })
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => listWarehouses(),
  })
  const { data: rows = [], isFetching: rowsLoading } = useQuery({
    queryKey: ['invoice-job-rows', jobId],
    queryFn: () => listInvoiceJobRows({ data: { jobId: jobId as string } }),
    enabled: Boolean(jobId),
  })

  const scan = useMutation({
    mutationFn: async (file: File) => {
      const signed = await uploadFn({
        data: { bucket: 'invoice-uploads', filename: file.name },
      })
      const { error } = await supabase.storage
        .from(signed.bucket)
        .uploadToSignedUrl(signed.path, signed.token, file)
      if (error) throw new Error(error.message)
      return analyzeFn({ data: { storagePath: signed.path, sourceName: file.name } })
    },
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error ?? 'تعذّر تحليل الفاتورة')
        return
      }
      setJobId(res.job_id)
      toast.success(
        `تم الاستخراج: ${res.counts.matched} مطابق · ${res.counts.new} جديد · ${res.counts.ambiguous} يحتاج مراجعة`,
      )
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const draft = useMutation({
    mutationFn: () =>
      draftFn({
        data: { jobId: jobId as string, supplierId, warehouseId, currency: 'YER' },
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error ?? 'تعذّر إنشاء أمر الشراء')
        return
      }
      toast.success(`تم إنشاء أمر شراء ${res.code} بعدد ${res.linesCreated} صنف`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function onPick(file: File | undefined): void {
    if (!file) return
    setPreview(URL.createObjectURL(file))
    setJobId(null)
    scan.mutate(file)
  }

  const matchedCount = rows.filter((r) => r.decision === 'matched').length

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pt-24 md:p-8 md:pt-24" dir="rtl">
      <header className="flex items-center gap-3">
        <ScanLine className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">مسح فاتورة المورد</h1>
          <p className="text-sm text-gray-500">
            صوّر الفاتورة، ويقوم النظام باستخراج الأصناف وتحويلها إلى أمر شراء مسودة.
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-sm backdrop-blur">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={scan.isPending}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {scan.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          التقاط / رفع صورة الفاتورة
        </button>
        {preview && (
          <img
            src={preview}
            alt="معاينة الفاتورة"
            className="mt-4 max-h-64 rounded-xl border border-gray-200 object-contain"
          />
        )}
      </section>

      {jobId && (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            الأصناف المستخرجة {rowsLoading && <Loader2 className="inline h-3 w-3 animate-spin" />}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="text-xs text-gray-500">
                <tr>
                  <th className="p-2">#</th>
                  <th className="p-2">الصنف</th>
                  <th className="p-2">الكمية</th>
                  <th className="p-2">التكلفة</th>
                  <th className="p-2">الانتهاء</th>
                  <th className="p-2">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="p-2 text-gray-400">{r.row_index + 1}</td>
                    <td className="p-2 font-medium text-gray-800">{r.name}</td>
                    <td className="p-2">{r.quantity ?? '—'}</td>
                    <td className="p-2">{r.unit_cost ?? '—'}</td>
                    <td className="p-2">{r.expiry_date ?? '—'}</td>
                    <td className="p-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          r.decision === 'matched'
                            ? 'bg-emerald-50 text-emerald-700'
                            : r.decision === 'new'
                              ? 'bg-sky-50 text-sky-700'
                              : r.decision === 'ambiguous'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {r.decision}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">اختر المورد…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">اختر المستودع…</option>
              {(warehouses as Array<{ id: string; name: string }>).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => draft.mutate()}
              disabled={!supplierId || !warehouseId || matchedCount === 0 || draft.isPending}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {draft.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileCheck2 className="h-4 w-4" />
              )}
              إنشاء أمر شراء مسودة ({matchedCount})
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
