import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { Camera, FileText, Loader2, Sparkles, Package, AlertTriangle, CheckCircle2, Link as LinkIcon } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import {
  createVisionUploadUrl,
  analyzePrescriptionImage,
  analyzeInvoiceImage,
  linkMediaByBarcode,
} from '@/lib/vision.functions'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/_authenticated/vision-lab')({
  head: () => ({
    meta: [
      { title: 'مختبر الرؤية الذكي — MUSLLY AI OS' },
      { name: 'description', content: 'تحليل الروشتات، فواتير الموردين، وربط صور المنتجات بالباركود.' },
    ],
  }),
  component: VisionLab,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-red-600">فشل التحميل: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-center">غير موجود</div>,
})

type Tab = 'prescription' | 'invoice' | 'media'

function VisionLab() {
  const [tab, setTab] = useState<Tab>('prescription')

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center gap-3">
          <Sparkles className="text-teal-400 w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold">مختبر الرؤية الذكي</h1>
            <p className="text-sm text-slate-400">
              تحليل الصور بالذكاء الاصطناعي: روشتات، فواتير، وصور منتجات.
            </p>
          </div>
        </header>

        <nav className="flex gap-2 border-b border-slate-800">
          {(
            [
              { key: 'prescription', label: 'تحليل روشتة', icon: FileText },
              { key: 'invoice', label: 'تحليل فاتورة مورد', icon: Camera },
              { key: 'media', label: 'ربط صور المنتجات', icon: LinkIcon },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 transition ${
                tab === key
                  ? 'border-teal-400 text-teal-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          {tab === 'prescription' && <PrescriptionPanel />}
          {tab === 'invoice' && <InvoicePanel />}
          {tab === 'media' && <MediaPanel />}
        </div>
      </div>
    </div>
  )
}

// ─── shared upload helper ─────────────────────────────────────────────────

function useUploader(bucket: 'prescriptions' | 'invoice-uploads' | 'product-images') {
  const createUrl = useServerFn(createVisionUploadUrl)
  return async (file: File): Promise<string> => {
    const { path, token } = await createUrl({ data: { bucket, filename: file.name } })
    const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(path, token, file, {
      contentType: file.type,
    })
    if (error) throw new Error(`فشل الرفع: ${error.message}`)
    return path
  }
}

// ─── S2: PRESCRIPTION PANEL ──────────────────────────────────────────────

function PrescriptionPanel() {
  const upload = useUploader('prescriptions')
  const analyze = useServerFn(analyzePrescriptionImage)
  const [file, setFile] = useState<File | null>(null)

  const mut = useMutation({
    mutationFn: async (f: File) => {
      const path = await upload(f)
      return analyze({ data: { storagePath: path } })
    },
  })

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        ارفع صورة الروشتة — سيتم استخراج الأدوية ومطابقتها بالكاتالوج.
      </p>
      <div className="flex items-center gap-3">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm text-slate-300"
        />
        <button
          disabled={!file || mut.isPending}
          onClick={() => file && mut.mutate(file)}
          className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50"
        >
          {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          تحليل
        </button>
      </div>

      {mut.error && (
        <div className="p-3 rounded-lg bg-red-950/50 text-red-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {(mut.error as Error).message}
        </div>
      )}

      {mut.data && mut.data.ok && (
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-slate-800/60 text-sm">
            <div>الطبيب: {mut.data.extraction.doctor_name ?? '—'}</div>
            <div>التاريخ: {mut.data.extraction.prescription_date ?? '—'}</div>
            <div>
              الثقة: {Math.round(mut.data.extraction.confidence * 100)}% ({mut.data.model}
              {mut.data.usedFallback ? ' — fallback' : ''})
            </div>
          </div>
          <div>
            <h3 className="font-bold mb-2">الأدوية والمطابقات:</h3>
            <ul className="space-y-2">
              {mut.data.matches.map((m, i) => (
                <li key={i} className="rounded-lg border border-slate-800 p-3">
                  <div className="font-semibold text-teal-300">{m.query}</div>
                  {m.products.length === 0 ? (
                    <div className="text-xs text-slate-500 mt-1">لا يوجد تطابق في الكاتالوج</div>
                  ) : (
                    <ul className="mt-2 space-y-1 text-sm">
                      {m.products.map((p) => (
                        <li key={p.id} className="flex items-center justify-between">
                          <span>
                            {p.name_ar}
                            {p.brand ? ` — ${p.brand}` : ''}
                          </span>
                          {p.requires_prescription && (
                            <span className="text-xs text-amber-400">يستلزم روشتة</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {mut.data && !mut.data.ok && (
        <div className="p-3 rounded-lg bg-amber-950/40 text-amber-200 text-sm">{mut.data.error}</div>
      )}
    </div>
  )
}

// ─── S3: INVOICE PANEL ───────────────────────────────────────────────────

function InvoicePanel() {
  const upload = useUploader('invoice-uploads')
  const analyze = useServerFn(analyzeInvoiceImage)
  const [file, setFile] = useState<File | null>(null)

  const mut = useMutation({
    mutationFn: async (f: File) => {
      const path = await upload(f)
      return analyze({ data: { storagePath: path } })
    },
  })

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        صور فاتورة المورد — سيتم استخراج الأصناف وإنشاء وظيفة استيراد للمراجعة في{' '}
        <Link to="/sbdma-import" className="text-teal-400 underline">
          صفحة الاستيراد
        </Link>
        .
      </p>
      <div className="flex items-center gap-3">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm text-slate-300"
        />
        <button
          disabled={!file || mut.isPending}
          onClick={() => file && mut.mutate(file)}
          className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50"
        >
          {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          تحليل الفاتورة
        </button>
      </div>

      {mut.error && (
        <div className="p-3 rounded-lg bg-red-950/50 text-red-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {(mut.error as Error).message}
        </div>
      )}

      {mut.data && mut.data.ok && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-300">
            <CheckCircle2 className="w-5 h-5" />
            تم إنشاء وظيفة الاستيراد
          </div>
          <div className="p-3 rounded-lg bg-slate-800/60 text-sm space-y-1">
            <div>المورد: {mut.data.supplier_name ?? '—'}</div>
            <div>مطابق: {mut.data.counts.matched}</div>
            <div>جديد: {mut.data.counts.new}</div>
            <div>غامض: {mut.data.counts.ambiguous}</div>
            <div>غير صالح: {mut.data.counts.invalid}</div>
          </div>
          <Link
            to="/sbdma-import"
            className="inline-block bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg"
          >
            مراجعة الوظيفة →
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── S4: MEDIA LINK PANEL ────────────────────────────────────────────────

function MediaPanel() {
  const upload = useUploader('product-images')
  const link = useServerFn(linkMediaByBarcode)
  const [file, setFile] = useState<File | null>(null)
  const [barcode, setBarcode] = useState('')

  const mut = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('اختر ملف صورة')
      let bc = barcode.trim()
      if (!bc) {
        // Derive barcode from filename: "6221234567890.jpg" → "6221234567890"
        bc = file.name.replace(/\.[^.]+$/, '').replace(/[^0-9]/g, '')
      }
      if (!bc) throw new Error('لم يتم العثور على باركود')
      const path = await upload(file)
      return link({ data: { barcode: bc, storagePath: path, kind: 'primary' } })
    },
  })

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        ارفع صورة المنتج — يتم ربطها تلقائيًا بالباركود. إذا سُميت الصورة برقم الباركود
        (مثلاً <code className="bg-slate-800 px-1 rounded">6221234567890.jpg</code>) فلا حاجة لإدخال الباركود يدويًا.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          type="text"
          placeholder="الباركود (اختياري إن كان اسم الملف = الباركود)"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm"
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm text-slate-300"
        />
        <button
          disabled={!file || mut.isPending}
          onClick={() => mut.mutate()}
          className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
          رفع وربط
        </button>
      </div>

      {mut.error && (
        <div className="p-3 rounded-lg bg-red-950/50 text-red-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {(mut.error as Error).message}
        </div>
      )}

      {mut.data && mut.data.ok && (
        <div className="p-3 rounded-lg bg-emerald-950/40 text-emerald-200 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> تم الربط بالمنتج: {mut.data.product_name}
        </div>
      )}
      {mut.data && !mut.data.ok && (
        <div className="p-3 rounded-lg bg-amber-950/40 text-amber-200 text-sm">{mut.data.error}</div>
      )}
    </div>
  )
}
