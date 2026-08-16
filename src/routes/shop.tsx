import { ProductImage } from '@/components/store/ProductImage'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, ShoppingCart, Lock, PackageSearch } from 'lucide-react'
import { z } from 'zod'
import { listProducts, listCategories } from '@/lib/catalog.functions'
import type { CatalogProduct } from '@/domain/catalog/schemas'
import {
  EmptyState as SharedEmptyState,
  ErrorState,
  ProductGridSkeleton,
} from '@/shared/components/StateViews'

const searchSchema = z.object({
  q: z.string().optional(),
  cat: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional(),
})

export const Route = createFileRoute('/shop')({
  validateSearch: (raw) => searchSchema.parse(raw),
  head: () => ({
    meta: [
      { title: 'متجر صيدلية المصلي — منتجات صحية' },
      {
        name: 'description',
        content:
          'تسوّق أدوية بدون وصفة، مستلزمات، وعناية شخصية من صيدلية المصلي مع خيارات شحن وتوصيل موثوقة.',
      },
      { property: 'og:title', content: 'متجر صيدلية المصلي' },
      { property: 'og:description', content: 'كتالوج شفاف بأسعار محدّثة وخيارات دفع مرنة.' },
    ],
  }),
  component: ShopPage,
})

const PAGE_SIZE = 24

function ShopPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const [q, setQ] = useState(search.q ?? '')

  const { data, isFetching, isError, refetch, isRefetching } = useQuery({
    queryKey: ['storefront', 'products', search],
    queryFn: () =>
      listProducts({
        data: {
          search: search.q,
          categoryId: search.cat,
          page: search.page,
          pageSize: PAGE_SIZE,
          publicOnly: true,
        },
      }),
    staleTime: 30_000,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['storefront', 'categories'],
    queryFn: () => listCategories(),
    staleTime: 5 * 60_000,
  })

  const products = data?.items ?? []
  const total = data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const setSearch = (patch: Partial<z.infer<typeof searchSchema>>) => {
    void navigate({ to: '/shop', search: { ...search, ...patch } })
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 pt-24 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-gray-900">متجر صيدلية المصلي</h1>
          <p className="text-sm text-gray-600">
            {total > 0
              ? `${total.toLocaleString('ar-EG')} منتج متاح للطلب`
              : 'اكتشف منتجات موثوقة قابلة للتوصيل'}
          </p>
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            setSearch({ q: q || undefined, page: 1 })
          }}
          className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث بالاسم، الماركة، أو الباركود…"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pr-9 pl-3 text-sm outline-none focus:border-primary focus:bg-white"
            />
          </div>
          <select
            value={search.cat ?? ''}
            onChange={(e) => setSearch({ cat: e.target.value || undefined, page: 1 })}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">جميع الفئات</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_ar}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-xl bg-primary px-5 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90"
          >
            بحث
          </button>
        </form>

        {isError ? (
          <ErrorState
            onRetry={() => void refetch()}
            isRetrying={isRefetching}
            description="تعذّر جلب قائمة المنتجات. تحقّق من الاتصال ثم أعد المحاولة."
          />
        ) : isFetching && products.length === 0 ? (
          <ProductGridSkeleton count={8} />
        ) : products.length === 0 ? (
          <SharedEmptyState
            icon={<PackageSearch className="h-8 w-8 text-gray-400 sm:h-10 sm:w-10" />}
            title={search.q || search.cat ? 'لا توجد نتائج مطابقة' : 'لا توجد منتجات حالياً'}
            description={
              search.q || search.cat
                ? 'جرّب تعديل كلمة البحث أو اختيار فئة أخرى.'
                : 'سيتم إضافة المنتجات قريباً.'
            }
            action={
              (search.q || search.cat) && (
                <button
                  type="button"
                  onClick={() => {
                    setQ('')
                    void navigate({ to: '/shop', search: {} })
                  }}
                  className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
                >
                  مسح الفلاتر
                </button>
              )
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            <Pagination
              page={search.page ?? 1}
              pages={pages}
              onChange={(page) => setSearch({ page: page === 1 ? undefined : page })}
            />
          </>
        )}
      </div>
    </div>
  )
}

function ProductCard({ product }: { product: CatalogProduct }) {
  const price =
    typeof product.sbdma_official_price === 'number'
      ? product.sbdma_official_price
      : null
  return (
    <Link
      to="/product/$productId"
      params={{ productId: product.id }}
      className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
    >
      <ProductImage
        product={product}
        alt={product.name_ar ?? 'منتج'}
        rounded="rounded-xl"
        className="mb-3 aspect-square w-full"
      />
      <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">
        {product.name_ar}
      </h3>
      <p className="mt-1 line-clamp-1 text-xs text-gray-500">
        {[product.brand, product.strength].filter(Boolean).join(' · ') || '—'}
      </p>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-base font-bold text-primary">
          {price !== null ? `${price.toLocaleString('ar-EG')} ر.ي` : 'اطلب سعرًا'}
        </span>
        {product.requires_prescription ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
            <Lock className="h-3 w-3" /> بوصفة
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
            <ShoppingCart className="h-3 w-3" /> متاح
          </span>
        )}
      </div>
    </Link>
  )
}


function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number
  pages: number
  onChange: (p: number) => void
}) {
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-2 pt-2">
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
      >
        السابق
      </button>
      <span className="text-sm text-gray-600">
        صفحة {page} من {pages}
      </span>
      <button
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
      >
        التالي
      </button>
    </div>
  )
}
