import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { toast } from 'sonner'
import { getProduct, getProductAiSummary } from '@/lib/catalog.functions'
import { getStockSummary } from '@/lib/inventory.functions'
import { listProductImageUrls } from '@/lib/storefront.functions'
import { registerProductImage, deleteProductImage } from '@/lib/catalog-media.functions'
import { supabase } from '@/integrations/supabase/client'
import { ArrowRight, Package, Upload, Trash2, Loader2 } from 'lucide-react'
import type { CatalogBarcode } from '@/domain/catalog/schemas'

export const Route = createFileRoute('/_authenticated/catalog/$productId')({
  head: () => ({
    meta: [
      { title: 'تفاصيل المنتج — MUSLLY AI OS' },
      { name: 'description', content: 'تفاصيل المنتج والمخزون والباركود.' },
    ],
  }),
  component: ProductDetail,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-red-600">تعذر تحميل المنتج: {error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-center">
      <p className="mb-4">المنتج غير موجود.</p>
      <Link to="/catalog" search={{ page: 1 }} className="text-primary underline">
        العودة للكتالوج
      </Link>
    </div>
  ),
})

function ProductDetail() {
  const params = Route.useParams()
  const { data, isLoading } = useQuery({
    queryKey: ['catalog', 'product', params.productId],
    queryFn: () => getProduct({ data: { id: params.productId } }),
  })
  const { data: stock } = useQuery({
    queryKey: ['inventory', 'stock-summary', params.productId],
    queryFn: () => getStockSummary({ data: { productId: params.productId } }),
  })
  const aiSummary = useServerFn(getProductAiSummary)
  const [aiText, setAiText] = useState<string | null>(null)
  const aiMutation = useMutation({
    mutationFn: () => aiSummary({ data: { productId: params.productId } }),
    onSuccess: (r) => setAiText(r.output ?? 'لا يوجد ملخص متاح.'),
    onError: (e: Error) => toast.error(`تعذر توليد الملخص: ${e.message}`),
  })

  if (isLoading) return <div className="p-8 text-center">جاري التحميل...</div>
  if (!data) {
    return (
      <div className="p-8 text-center">
        <p className="mb-4">المنتج غير موجود.</p>
        <Link to="/catalog" search={{ page: 1 }} className="text-primary underline">
          العودة للكتالوج
        </Link>
      </div>
    )
  }
  const { product, barcodes } = data
  const barcodeRows = barcodes as unknown as CatalogBarcode[]

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <Link
        to="/catalog"
        search={{ page: 1 }}
        className="flex items-center gap-2 text-sm text-primary"
      >
        <ArrowRight className="h-4 w-4" />
        العودة للكتالوج
      </Link>

      <header className="glass-panel rounded-2xl p-6">
        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-2xl bg-primary/5">
            <Package className="h-16 w-16 text-primary" />
          </div>
          <div className="flex-1 space-y-2">
            <h1 className="text-2xl font-bold">{product.name_ar}</h1>
            {product.name_en && (
              <p className="text-sm text-muted-foreground">{product.name_en}</p>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              {product.brand && (
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                  {product.brand}
                </span>
              )}
              {product.manufacturer && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                  {product.manufacturer}
                </span>
              )}
              {product.dosage_form && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                  {product.dosage_form}
                </span>
              )}
              {product.strength && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                  {product.strength}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="المخزون" value={(stock?.totalOnHand ?? 0).toLocaleString('ar-EG')} />
        <Stat label="المحجوز" value={(stock?.totalReserved ?? 0).toLocaleString('ar-EG')} />
        <Stat label="الدُفعات" value={String(stock?.batches ?? 0)} />
      </section>

      <section className="glass-panel rounded-2xl p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">شرح بالذكاء الاصطناعي</h2>
          <button
            onClick={() => aiMutation.mutate()}
            disabled={aiMutation.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {aiMutation.isPending ? 'جاري التوليد...' : 'اشرح بالذكاء الاصطناعي'}
          </button>
        </div>
        {aiText && (
          <p className="whitespace-pre-wrap text-sm leading-7 text-gray-700">{aiText}</p>
        )}
      </section>

      {product.description_ar && (
        <section className="glass-panel rounded-2xl p-6">
          <h2 className="mb-3 text-lg font-semibold">الوصف</h2>
          <p className="whitespace-pre-line text-sm text-gray-700">
            {product.description_ar}
          </p>
        </section>
      )}

      <section className="glass-panel rounded-2xl p-6">
        <h2 className="mb-3 text-lg font-semibold">الباركود</h2>
        {barcodeRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا يوجد باركود مسجّل.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {barcodeRows.map((b) => (
              <li key={b.id} className="font-mono">
                {b.barcode}{' '}
                {b.is_primary && <span className="text-xs text-primary">(أساسي)</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <MediaSection productId={params.productId} />
    </div>
  )
}

function MediaSection({ productId }: { productId: string }) {
  const qc = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const { data: images = [] } = useQuery({
    queryKey: ['storefront', 'product', productId, 'images'],
    queryFn: () => listProductImageUrls({ data: { productId } }),
  })
  const registerFn = useServerFn(registerProductImage)
  const deleteFn = useServerFn(deleteProductImage)
  const register = useMutation({
    mutationFn: (v: { storagePath: string; kind: 'primary' | 'gallery' }) =>
      registerFn({ data: { productId, ...v } }),
    onSuccess: () => {
      toast.success('تم رفع الصورة')
      void qc.invalidateQueries({ queryKey: ['storefront', 'product', productId, 'images'] })
      void qc.invalidateQueries({ queryKey: ['catalog', 'product', productId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: (mediaId: string) => deleteFn({ data: { mediaId } }),
    onSuccess: () => {
      toast.success('تم الحذف')
      void qc.invalidateQueries({ queryKey: ['storefront', 'product', productId, 'images'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  async function onUpload(file: File) {
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${productId}/${crypto.randomUUID()}.${ext}`
      const up = await supabase.storage
        .from('product-images')
        .upload(path, file, { upsert: false, contentType: file.type })
      if (up.error) throw new Error(up.error.message)
      const kind = images.length === 0 ? 'primary' : 'gallery'
      await register.mutateAsync({ storagePath: path, kind })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="glass-panel rounded-2xl p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">صور المنتج</h2>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90">
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {uploading ? 'جارٍ الرفع…' : 'رفع صورة'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onUpload(f)
              e.target.value = ''
            }}
          />
        </label>
      </div>
      {images.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          لم يتم رفع صور بعد. الصورة الأولى تصبح تلقائياً الصورة الرئيسية.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((img, i) => (
            <div key={i} className="group relative rounded-xl border border-gray-200 bg-gray-50">
              <img src={img.url} alt="" className="aspect-square w-full rounded-xl object-contain" />
              <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] text-gray-700">
                {img.kind}
              </span>
            </div>
          ))}
        </div>
      )}
      {/* Media list for delete (uses ordered admin list) */}
      <AdminMediaDeleteList productId={productId} onDelete={(id) => remove.mutate(id)} />
    </section>
  )
}

function AdminMediaDeleteList({
  productId,
  onDelete,
}: {
  productId: string
  onDelete: (mediaId: string) => void
}) {
  const { data } = useQuery({
    queryKey: ['catalog', 'product', productId],
    queryFn: () => getProduct({ data: { id: productId } }),
  })
  const rows =
    (data?.media as unknown as Array<{ id: string; storage_path: string; kind: string }>) ?? []
  if (rows.length === 0) return null
  return (
    <ul className="mt-4 divide-y divide-gray-100 text-sm">
      {rows.map((m) => (
        <li key={m.id} className="flex items-center justify-between py-2">
          <span className="truncate text-gray-700">
            <span className="font-mono text-xs text-gray-500">{m.kind}</span> · {m.storage_path}
          </span>
          <button
            onClick={() => onDelete(m.id)}
            className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
            aria-label="حذف"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-panel rounded-2xl p-5 text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
