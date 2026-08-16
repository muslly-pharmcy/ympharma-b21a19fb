import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { FileUp, Loader2, CheckCircle2, XCircle, Download } from 'lucide-react'
type XLSXModule = typeof import('xlsx')
let _xlsx: XLSXModule | null = null
const loadXLSX = async (): Promise<XLSXModule> => {
  if (!_xlsx) _xlsx = await import('xlsx')
  return _xlsx
}
import { bulkImportExcel, type ExcelProductRow } from '@/lib/excel-import.functions'

export const Route = createFileRoute('/_authenticated/admin-excel-import')({
  head: () => ({
    meta: [
      { title: 'استيراد Excel — لوحة التحكم' },
      { name: 'description', content: 'رفع ملف Excel لتحديث الأصناف والأسعار والمخزون.' },
    ],
  }),
  component: AdminExcelImport,
  errorComponent: ({ error }) => (
    <div className="p-8 text-red-600" dir="rtl">فشل: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8" dir="rtl">غير موجود</div>,
})

type Result = Awaited<ReturnType<typeof bulkImportExcel>>

// Try to map various common Arabic/English column names to our canonical fields.
function normalizeRow(raw: Record<string, unknown>): ExcelProductRow | null {
  const pick = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      for (const rk of Object.keys(raw)) {
        if (rk.trim().toLowerCase() === k.toLowerCase()) {
          const v = raw[rk]
          if (v === null || v === undefined || v === '') continue
          return String(v).trim()
        }
      }
    }
    return undefined
  }
  const num = (v: string | undefined) => {
    if (!v) return null
    const n = Number(v.replace(/[,،\s]/g, ''))
    return Number.isFinite(n) ? n : null
  }

  const name_ar = pick('name_ar', 'الاسم', 'اسم الصنف', 'الصنف', 'name', 'product', 'product_name')
  const store_code = pick('store_code', 'code', 'الكود', 'رمز', 'sku', 'id') ??
    (name_ar ? 'AUTO-' + name_ar.replace(/\s+/g, '-').slice(0, 40) : undefined)
  if (!name_ar || !store_code) return null

  return {
    store_code,
    name_ar,
    name_en: pick('name_en', 'english', 'الانجليزي') ?? null,
    brand: pick('brand', 'الماركة', 'الشركة') ?? null,
    manufacturer: pick('manufacturer', 'المصنع', 'المنتج') ?? null,
    barcode: pick('barcode', 'الباركود') ?? null,
    strength: pick('strength', 'التركيز', 'العيار') ?? null,
    dosage_form: pick('dosage_form', 'الشكل', 'form') ?? null,
    price: num(pick('price', 'السعر', 'سعر')),
    qty: num(pick('qty', 'quantity', 'الكمية', 'كمية', 'stock', 'المخزون')),
    category_slug: pick('category_slug', 'category', 'التصنيف') ?? null,
  }
}

function AdminExcelImport() {
  const [rows, setRows] = useState<ExcelProductRow[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  const importMut = useMutation({
    mutationFn: (payload: ExcelProductRow[]) =>
      bulkImportExcel({ data: { rows: payload } }),
    onSuccess: setResult,
  })

  const onFile = async (file: File) => {
    setParseError(null)
    setResult(null)
    setFileName(file.name)
    try {
      const XLSX = await loadXLSX()
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      const mapped: ExcelProductRow[] = []
      let skipped = 0
      for (const r of json) {
        const n = normalizeRow(r)
        if (n) mapped.push(n)
        else skipped++
      }
      setRows(mapped)
      if (mapped.length === 0) setParseError(`لم يتم التعرف على أي صف صالح (${skipped} صف مُتجاهل)`)
    } catch (e) {
      setParseError((e as Error).message)
    }
  }

  const downloadTemplate = async () => {
    const XLSX = await loadXLSX()
    const ws = XLSX.utils.json_to_sheet([
      {
        store_code: 'DEMO-001',
        name_ar: 'باراسيتامول 500 ملغ',
        name_en: 'Paracetamol 500mg',
        brand: 'Panadol',
        manufacturer: 'GSK',
        barcode: '6221234567890',
        strength: '500mg',
        dosage_form: 'قرص',
        price: 250,
        qty: 100,
        category_slug: 'pain-fever',
      },
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'products')
    XLSX.writeFile(wb, 'excel-template.xlsx')
  }

  return (
    <div dir="rtl" className="mx-auto max-w-5xl space-y-6 p-6 pt-24">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">استيراد Excel للأصناف والمخزون</h1>
        <p className="text-sm text-gray-600">
          ارفع ملف Excel لتحديث/إضافة الأصناف مع الأسعار والكميات. الأعمدة المدعومة:
          <code className="mx-1 rounded bg-gray-100 px-1 text-xs">
            store_code, name_ar, name_en, brand, manufacturer, barcode, strength, dosage_form,
            price, qty, category_slug
          </code>
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
          <FileUp className="h-4 w-4" />
          اختر ملف .xlsx / .xls
          <input
            type="file"
            className="hidden"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onFile(f)
            }}
          />
        </label>
        <button
          onClick={downloadTemplate}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Download className="h-4 w-4" /> حمّل قالب نموذجي
        </button>
        {fileName && <span className="text-sm text-gray-500">📄 {fileName}</span>}
      </div>

      {parseError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {parseError}
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div>
              <p className="text-sm text-gray-500">صفوف جاهزة للاستيراد</p>
              <p className="text-2xl font-bold text-primary">{rows.length.toLocaleString('ar-EG')}</p>
            </div>
            <button
              disabled={importMut.isPending}
              onClick={() => importMut.mutate(rows)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {importMut.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> جارٍ الاستيراد…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> بدء الاستيراد
                </>
              )}
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-right text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="p-3">الكود</th>
                  <th className="p-3">الاسم</th>
                  <th className="p-3">الماركة</th>
                  <th className="p-3">السعر</th>
                  <th className="p-3">الكمية</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="p-3 font-mono text-xs">{r.store_code}</td>
                    <td className="p-3">{r.name_ar}</td>
                    <td className="p-3">{r.brand ?? '—'}</td>
                    <td className="p-3">{r.price ?? '—'}</td>
                    <td className="p-3">{r.qty ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 20 && (
              <p className="p-3 text-center text-xs text-gray-500">
                … {(rows.length - 20).toLocaleString('ar-EG')} صف إضافي
              </p>
            )}
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 className="h-5 w-5" />
            <h2 className="text-lg font-bold">اكتمل الاستيراد</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="إجمالي" value={result.total} />
            <Stat label="مضاف جديد" value={result.inserted} />
            <Stat label="محدّث" value={result.updated} />
            <Stat label="فشل" value={result.skipped} />
          </div>
          {result.errors.length > 0 && (
            <details className="rounded-xl bg-white p-4">
              <summary className="cursor-pointer text-sm font-semibold text-red-700">
                {result.errors.length} خطأ — عرض التفاصيل
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-gray-700">
                {result.errors.map((e, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-500" />
                    <span>
                      <b>{e.store_code}</b>: {e.error}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white p-3 text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-bold text-primary">{value.toLocaleString('ar-EG')}</p>
    </div>
  )
}
