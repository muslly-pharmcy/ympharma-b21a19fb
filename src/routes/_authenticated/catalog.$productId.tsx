import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { toast } from 'sonner'
import { getAdminProductDetail, getProductAiSummary } from '@/lib/catalog.functions'
import { getStockSummary } from '@/lib/inventory.functions'
import { listProductImageUrls } from '@/lib/storefront.functions'
import {
  listAdminProductImages,
  uploadProductImage,
  deleteProductImage,
  approveProductImage,
} from '@/lib/catalog-media.functions'
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
    <div className="p-8 text-center text-red-600">تعذر تحميل المنتج: {(error instanceof Error ? error.message : 'حدث خطأ غير متوقع')}</div>
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
  const getDetail = useServerFn(getAdminProductDetail)
  const { data, isLoading, error } = useQuery({
    queryKey: ['catalog', 'product', params.productId],
    queryFn: () => getDetail({ data: { id: params.productId } }),
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
  if (error) return <div role="alert" className="p-8 text-center text-red-600">تعذر تحميل المنتج: {error.message}</div>
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

      {data.canManageImages ? (
        <MediaSection productId={params.productId} />
      ) : (
        <ReadOnlyProductImages productId={params.productId} />
      )}
    </div>
  )
}

function ReadOnlyProductImages({ productId }: { productId: string }) {
  const getImages = useServerFn(listProductImageUrls)
  const { data: images = [], error } = useQuery({
    queryKey: ['storefront', 'product', productId, 'images'],
    queryFn: () => getImages({ data: { productId } }),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  })
  return (
    <section className="glass-panel rounded-2xl p-6">
      <h2 className="mb-3 text-lg font-semibold">صور المنتج</h2>
      <p className="mb-3 text-sm text-muted-foreground">هذا المنتج متاح للعرض. إدارة الصور تتطلب صلاحية تعديل المنتج داخل مؤسستك.</p>
      {error ? (
        <p role="alert" className="text-sm text-red-600">تعذر تحميل الصور: {error.message}</p>
      ) : images.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((image, index) => (
            <img key={index} src={image.url} alt={image.alt ?? ''} className="aspect-square w-full rounded-xl border object-contain" />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">لا توجد صور منشورة لهذا المنتج.</p>
      )}
    </section>
  )
}

function MediaSection({ productId }: { productId: string }) {
  const qc = useQueryClient()
  const getImages = useServerFn(listAdminProductImages)
  const uploadFn = useServerFn(uploadProductImage)
  const deleteFn = useServerFn(deleteProductImage)
  const approveFn = useServerFn(approveProductImage)
  const { data: images = [], error, isLoading } = useQuery({
    queryKey: ['catalog', 'product-media', productId],
    queryFn: () => getImages({ data: { productId } }),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  })

  function refreshImages() {
    void qc.invalidateQueries({ queryKey: ['catalog', 'product-media', productId] })
    void qc.invalidateQueries({ queryKey: ['catalog', 'product', productId] })
    void qc.invalidateQueries({ queryKey: ['catalog'] })
    void qc.invalidateQueries({ queryKey: ['admin-inventory'] })
    void qc.invalidateQueries({ queryKey: ['storefront'] })
  }

  const upload = useMutation({
    mutationFn: (file: File) => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        throw new Error('اختر صورة JPEG أو PNG أو WebP')
      }
      if (file.size === 0 || file.size > 5 * 1024 * 1024) {
        throw new Error('حجم الصورة يجب أن يكون بين 1 بايت و5 ميغابايت')
      }
      const form = new FormData()
      form.set('productId', productId)
      form.set('kind', images.length === 0 ? 'primary' : 'gallery')
      form.set('file', file)
      return uploadFn({ data: form })
    },
    onSuccess: (result) => {
      toast.success(result.status === 'approved' ? 'تم رفع الصورة واعتمادها' : 'تم رفع الصورة وهي بانتظار المراجعة')
      refreshImages()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: (mediaId: string) => deleteFn({ data: { mediaId } }),
    onSuccess: () => {
      toast.success('تم حذف الصورة')
      refreshImages()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const approve = useMutation({
    mutationFn: (mediaId: string) => approveFn({ data: { mediaId } }),
    onSuccess: () => {
      toast.success('تم اعتماد الصورة ونشرها')
      refreshImages()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <section className="glass-panel rounded-2xl p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">صور المنتج</h2>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90">
          {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {upload.isPending ? 'جارٍ الرفع…' : 'رفع صورة'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={upload.isPending || isLoading || Boolean(error)}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) upload.mutate(file)
              e.target.value = ''
            }}
          />
        </label>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">JPEG أو PNG أو WebP، حتى 5 ميغابايت. تظهر الصور للزوار بعد اعتمادها.</p>
      {error ? (
        <p role="alert" className="text-sm text-red-600">تعذر تحميل الصور: {error.message}</p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">جاري تحميل الصور…</p>
      ) : images.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          لم يتم رفع صور بعد. الصورة الأولى تصبح تلقائياً الصورة الرئيسية.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((image) => (
            <div key={image.id} className="rounded-xl border border-gray-200 bg-gray-50 p-2">
              {image.url ? (
                <img src={image.url} alt={image.alt ?? ''} className="aspect-square w-full rounded-lg object-contain" />
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-lg bg-gray-100 text-xs text-muted-foreground">المعاينة غير متاحة</div>
              )}
              <div className="mt-2 flex items-center justify-between gap-1">
                <span className="text-xs text-gray-700">
                  {image.kind === 'primary' ? 'رئيسية' : image.kind === 'thumbnail' ? 'مصغرة' : 'إضافية'}
                  {' · '}{image.status === 'approved' ? 'معتمدة' : image.status === 'pending' ? 'بانتظار المراجعة' : 'غير منشورة'}
                </span>
                {image.status === 'pending' && image.canApprove && (
                  <button
                    onClick={() => approve.mutate(image.id)}
                    disabled={approve.isPending || remove.isPending}
                    className="rounded-lg px-2 py-1 text-xs text-primary hover:bg-primary/10 disabled:opacity-50"
                  >
                    {approve.isPending && approve.variables === image.id ? 'جارٍ الاعتماد…' : 'اعتماد'}
                  </button>
                )}
                <button
                  onClick={() => remove.mutate(image.id)}
                  disabled={remove.isPending || approve.isPending}
                  className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                  aria-label="حذف الصورة"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
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
