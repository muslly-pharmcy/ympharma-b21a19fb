import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  ArrowRight,
  Package,
  ShoppingCart,
  Lock,
  ShieldCheck,
  Truck,
  RotateCcw,
} from 'lucide-react'
import { getProduct } from '@/lib/catalog.functions'
import { listProductImageUrls } from '@/lib/storefront.functions'
import { addToCart } from '@/lib/cart.functions'
import { supabase } from '@/integrations/supabase/client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ProductAiGuide } from '@/components/store/ProductAiGuide'
import { PharmacologyPanel } from '@/components/store/PharmacologyPanel'

export const Route = createFileRoute('/product/$productId')({
  parseParams: (p) => ({ productId: z.string().uuid().parse(p.productId) }),
  loader: async ({ params }) => {
    const res = await getProduct({ data: { id: params.productId } })
    return { product: res?.product ?? null }
  },
  head: ({ params, loaderData }) => {
    const product = loaderData?.product
    const url = `https://muslly.com/product/${params.productId}`
    if (!product) {
      return {
        meta: [
          { title: 'تفاصيل المنتج — صيدلية المصلي' },
          { name: 'description', content: 'تفاصيل المنتج، السعر، والسياسات.' },
        ],
        links: [{ rel: 'canonical', href: url }],
      }
    }
    const name = product.name_ar || product.name_en || 'منتج'
    const price =
      typeof product.sbdma_official_price === 'number'
        ? product.sbdma_official_price
        : null
    const description =
      [name, product.brand, product.strength, product.dosage_form]
        .filter(Boolean)
        .join(' · ') +
      (price !== null ? ` — السعر ${price} ر.ي` : '') +
      ' | صيدلية المصلي'
    const rawImage = (product as { image_url?: string | null }).image_url
    const image =
      typeof rawImage === 'string' && rawImage.startsWith('https://') ? rawImage : null

    const title = `${name} — صيدلية المصلي`
    return {
      meta: [
        { title },
        { name: 'description', content: description.slice(0, 158) },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description.slice(0, 158) },
        { property: 'og:type', content: 'product' },
        { property: 'og:url', content: url },
        ...(image ? [{ property: 'og:image', content: image }] : []),
        { name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description.slice(0, 158) },
        ...(image ? [{ name: 'twitter:image', content: image }] : []),
      ],
      links: [{ rel: 'canonical', href: url }],
      scripts: [
        {
          type: 'application/ld+json',
          children: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name,
            description: description.slice(0, 300),
            ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
            ...(image ? { image: [image] } : {}),
            ...(price !== null
              ? {
                  offers: {
                    '@type': 'Offer',
                    price,
                    priceCurrency: 'YER',
                    url,
                    availability: 'https://schema.org/InStock',
                  },
                }
              : {}),
          }),
        },
      ],
    }
  },

  component: ProductDetailPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-red-600">تعذر تحميل المنتج: {error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-center">
      المنتج غير موجود.{' '}
      <Link to="/shop" search={{ page: 1 }} className="text-primary underline">
        العودة للمتجر
      </Link>
    </div>
  ),
})

function ProductDetailPage() {
  const { productId } = Route.useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [signedIn, setSignedIn] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true
    void supabase.auth.getUser().then(({ data }) => {
      if (mounted) setSignedIn(!!data.user)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (mounted) setSignedIn(!!s?.user)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['storefront', 'product', productId],
    queryFn: () => getProduct({ data: { id: productId } }),
  })
  const { data: images = [] } = useQuery({
    queryKey: ['storefront', 'product', productId, 'images'],
    queryFn: () => listProductImageUrls({ data: { productId } }),
    staleTime: 5 * 60_000,
  })

  const addFn = useServerFn(addToCart)
  const addMut = useMutation({
    mutationFn: () => addFn({ data: { productId, quantity: 1 } }),
    onSuccess: () => {
      toast.success('أُضيف إلى السلة')
      void qc.invalidateQueries({ queryKey: ['cart'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading) return <div className="p-8 pt-24 text-center">جاري التحميل…</div>
  if (!data) {
    return (
      <div className="p-8 pt-24 text-center">
        المنتج غير موجود.{' '}
        <Link to="/shop" search={{ page: 1 }} className="text-primary underline">
          العودة للمتجر
        </Link>
      </div>
    )
  }

  const { product } = data
  const price =
    typeof product.sbdma_official_price === 'number'
      ? product.sbdma_official_price
      : null
  const hero = images[0]?.url

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 pt-24 sm:px-6 lg:px-8">
        <Link
          to="/shop"
          search={{ page: 1 }}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary"
        >
          <ArrowRight className="h-4 w-4" /> العودة للمتجر
        </Link>

        <div className="grid grid-cols-1 gap-8 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm lg:grid-cols-2">
          <div className="space-y-3">
            <div className="flex aspect-square items-center justify-center rounded-2xl bg-gray-50">
              {hero ? (
                <img
                  src={hero}
                  alt={images[0]?.alt ?? product.name_ar}
                  className="h-full w-full rounded-2xl object-contain"
                />
              ) : (
                <Package className="h-24 w-24 text-gray-300" />
              )}
            </div>
            {images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {images.slice(0, 8).map((img, i) => (
                  <div
                    key={i}
                    className="flex aspect-square items-center justify-center rounded-xl bg-gray-50"
                  >
                    <img
                      src={img.url}
                      alt={img.alt ?? ''}
                      className="h-full w-full rounded-xl object-contain"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{product.name_ar}</h1>
              {product.name_en && (
                <p className="text-sm text-gray-500">{product.name_en}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {product.brand && (
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                  {product.brand}
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
              {product.manufacturer && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                  {product.manufacturer}
                </span>
              )}
            </div>

            <div className="rounded-2xl bg-primary/5 p-4">
              <p className="text-xs text-gray-600">السعر</p>
              <p className="mt-1 text-3xl font-bold text-primary">
                {price !== null ? `${price.toLocaleString('ar-EG')} ر.ي` : 'يُطلب السعر'}
              </p>
            </div>

            {product.requires_prescription ? (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <Lock className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  هذا المنتج يتطلب <b>وصفة طبية</b>. يرجى التواصل مع الصيدلي أو رفع
                  الوصفة قبل الطلب — لا يمكن إضافته للسلة مباشرة.
                </div>
              </div>
            ) : signedIn === false ? (
              <Link
                to="/auth"
                className="block w-full rounded-2xl bg-primary py-3 text-center text-sm font-semibold text-white shadow-sm hover:opacity-90"
              >
                سجّل الدخول لإتمام الشراء
              </Link>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => addMut.mutate()}
                  disabled={addMut.isPending}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
                >
                  <ShoppingCart className="h-4 w-4" />
                  {addMut.isPending ? 'جارٍ الإضافة…' : 'أضف إلى السلة'}
                </button>
                <button
                  onClick={async () => {
                    await addMut.mutateAsync()
                    void navigate({ to: '/checkout' })
                  }}
                  disabled={addMut.isPending}
                  className="rounded-2xl border border-primary/40 bg-white px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
                >
                  اشترِ الآن
                </button>
              </div>
            )}

            {product.description_ar && (
              <div className="rounded-2xl bg-gray-50 p-4">
                <h2 className="mb-2 text-sm font-semibold text-gray-900">الوصف</h2>
                <p className="whitespace-pre-line text-sm leading-6 text-gray-700">
                  {product.description_ar}
                </p>
              </div>
            )}

            <PharmacologyPanel
              product={product}
              displayName={product.name_ar ?? product.name_en ?? 'المنتج'}
              available={price !== null}
            />

            <ProductAiGuide productId={productId} />

            <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-3">
              <Policy icon={Truck} title="موعد التوصيل" desc="يُؤكد حسب المنطقة والتوفر" />
              <Policy icon={ShieldCheck} title="مراجعة صيدلية" desc="تحقق من الصنف والعبوة" />
              <Policy icon={RotateCcw} title="سياسة إرجاع" desc="خلال 24 ساعة إذا تلف الصنف" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Policy({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof Truck
  title: string
  desc: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-900">{title}</p>
        <p className="truncate text-[11px] text-gray-500">{desc}</p>
      </div>
    </div>
  )
}
