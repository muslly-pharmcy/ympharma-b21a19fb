import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { ArrowRight, Package, Lock, ShoppingCart, CircleCheck, CircleX } from 'lucide-react'
import { getStoreProductByCode } from '@/lib/store.functions'
import { addToCart } from '@/lib/cart.functions'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/store/$code')({
  head: ({ params }) => ({
    meta: [
      { title: `منتج ${params.code} — المتجر` },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: StoreProductPage,
})

function StoreProductPage() {
  const { code } = Route.useParams()
  const router = useRouter()
  const qc = useQueryClient()
  const fetchOne = useServerFn(getStoreProductByCode)
  const addFn = useServerFn(addToCart)

  const { data: item, isLoading, error } = useQuery({
    queryKey: ['store', 'product', code],
    queryFn: () => fetchOne({ data: { code } }),
    staleTime: 60_000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnReconnect: true,
    placeholderData: (prev) => prev,
  })

  const add = useMutation({
    mutationFn: (productId: string) => addFn({ data: { productId, quantity: 1 } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart'] })
      toast.success('تمت الإضافة إلى السلة')
    },
    onError: (err) => toast.error((err as Error).message),
  })

  if (isLoading) {
    return <div dir="rtl" className="p-8 pt-24 text-center text-muted-foreground">جاري التحميل…</div>
  }
  if (error) throw error
  if (!item) throw notFound()

  const inStock = Number(item.stock_balance ?? 0) > 0
  const price = item.price != null ? Number(item.price).toLocaleString('ar-EG') : '—'

  return (
    <div dir="rtl" className="max-w-5xl mx-auto p-4 md:p-8 pt-24 space-y-5">
      <button
        onClick={() => router.history.back()}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowRight className="w-4 h-4" /> عودة
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border rounded-2xl bg-background p-4 md:p-6">
        <div className="aspect-square bg-muted rounded-xl flex items-center justify-center overflow-hidden">
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.name ?? ''}
              className="w-full h-full object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <Package className="w-24 h-24 text-muted-foreground/40" />
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <h1 className="text-2xl font-bold">{item.name ?? '—'}</h1>
            {item.requires_prescription && (
              <span className="mt-1 inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                <Lock className="w-3 h-3" /> وصفة
              </span>
            )}
          </div>
          {item.name_en && <p className="text-sm text-muted-foreground">{item.name_en}</p>}

          <div className="text-3xl font-bold text-primary">{price} ر.ي</div>

          <div className={`inline-flex items-center gap-1.5 text-sm ${inStock ? 'text-emerald-600' : 'text-rose-600'}`}>
            {inStock ? <CircleCheck className="w-4 h-4" /> : <CircleX className="w-4 h-4" />}
            {inStock ? 'متوفر' : 'غير متوفر'}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm pt-2">
            <Row k="الكود" v={item.store_code} />
            <Row k="الباركود" v={item.barcode} />
            <Row k="المورد" v={item.supplier_name_text} />
            <Row k="العلامة" v={item.brand} />
            <Row k="الوحدة" v={item.pack_unit} />
            <Row k="التركيز" v={item.strength} />
            <Row k="الشكل" v={item.dosage_form} />
          </dl>

          {item.id && (
            <div className="pt-4 flex gap-2">
              <button
                disabled={!inStock || item.requires_prescription || add.isPending}
                onClick={() => item.id && add.mutate(item.id)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-40 hover:opacity-90"
              >
                <ShoppingCart className="w-4 h-4" />
                {add.isPending ? 'جارٍ الإضافة…' : 'أضف إلى السلة'}
              </button>
              <Link to="/cart" className="px-5 py-2.5 rounded-xl border text-sm hover:bg-primary/5">
                عرض السلة
              </Link>
            </div>
          )}
          {item.requires_prescription && (
            <p className="text-xs text-amber-700">هذا المنتج يتطلب وصفة طبية — لا يمكن طلبه مباشرة.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium">{v ?? '—'}</dd>
    </>
  )
}
