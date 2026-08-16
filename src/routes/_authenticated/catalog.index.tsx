import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useDeferredValue, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listProducts, listCategories } from '@/lib/catalog.functions'
import type { CatalogProduct } from '@/domain/catalog/schemas'

import { Pill, Search } from 'lucide-react'
import { z } from 'zod'

const YER = new Intl.NumberFormat('ar-YE', {
  style: 'currency',
  currency: 'YER',
  maximumFractionDigits: 0,
})


const searchSchema = z.object({
  q: z.string().optional(),
  cat: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
})

export const Route = createFileRoute('/_authenticated/catalog/')({
  validateSearch: (raw) => searchSchema.parse(raw),
  head: () => ({
    meta: [
      { title: 'كتالوج المنتجات — MUSLLY AI OS' },
      { name: 'description', content: 'استعراض جميع منتجات الصيدلية مع البحث والتصفية.' },
      { property: 'og:title', content: 'كتالوج المنتجات' },
      { property: 'og:description', content: 'أساس بيانات المنتجات لنظام MUSLLY AI OS.' },
    ],
  }),
  component: CatalogPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-red-600">فشل تحميل الكتالوج: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-center">غير موجود</div>,
})

function CatalogPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const [q, setQ] = useState(search.q ?? '')
  const deferredQ = useDeferredValue(q)

  // Debounced URL sync as user types
  useEffect(() => {
    const trimmed = deferredQ.trim()
    if ((search.q ?? '') === trimmed) return
    const t = setTimeout(() => {
      void navigate({
        to: '/catalog',
        search: { ...search, q: trimmed || undefined, page: 1 },
      })
    }, 350)
    return () => clearTimeout(t)
  }, [deferredQ, navigate, search])

  const { data, isFetching } = useQuery({
    queryKey: ['catalog', 'products', search],
    queryFn: () =>
      listProducts({
        data: {
          search: search.q,
          categoryId: search.cat,
          page: search.page,
          pageSize: 24,
          publicOnly: true,
        },
      }),
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['catalog', 'categories'],
    queryFn: () => listCategories(),
  })

  const products = (data?.items ?? []) as Array<
    CatalogProduct & {
      primary_image_url?: string
      sbdma_official_price?: number | string | null
      manufacturer?: string | null
    }
  >
  const total = data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / 24))

  const setSearch = (patch: Partial<z.infer<typeof searchSchema>>) => {
    void navigate({
      to: '/catalog',
      search: { ...search, ...patch },
    })
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">كتالوج المنتجات</h1>
        <p className="text-sm text-muted-foreground">
          إجمالي {total.toLocaleString('ar-EG')} منتج
        </p>
      </header>

      <div className="glass-panel flex flex-col gap-3 rounded-2xl p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث بالاسم أو الباركود أو المادة الفعالة..."
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-4 pr-10 text-right focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select
          value={search.cat ?? ''}
          onChange={(e) => setSearch({ cat: e.target.value || undefined, page: 1 })}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2.5"
        >
          <option value="">كل الفئات</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name_ar}
            </option>
          ))}
        </select>
      </div>

      {isFetching && <p className="text-sm text-muted-foreground">جاري التحميل...</p>}

      {products.length === 0 ? (
        <div className="glass-panel flex flex-col items-center gap-3 rounded-2xl p-12 text-center">
          <Pill className="h-12 w-12 text-gray-400" />
          <p className="text-lg font-medium">لا توجد منتجات مطابقة</p>
          <p className="text-sm text-muted-foreground">
            جرّب توسيع البحث أو إضافة منتجات جديدة إلى الكتالوج.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => {
            const priceNum = p.sbdma_official_price != null ? Number(p.sbdma_official_price) : null
            return (
              <Link
                key={p.id}
                to="/catalog/$productId"
                params={{ productId: p.id }}
                className="glass-panel group flex flex-col rounded-2xl p-4 transition hover:shadow-lg"
              >
                <div className="mb-3 flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-primary/5">
                  {p.primary_image_url ? (
                    <img
                      src={p.primary_image_url}
                      alt={p.name_ar}
                      loading="lazy"
                      className="h-full w-full object-contain transition group-hover:scale-105"
                    />
                  ) : (
                    <Pill className="h-16 w-16 text-primary/40" />
                  )}
                </div>
                <h3 className="line-clamp-2 font-semibold text-gray-900">{p.name_ar}</h3>
                {p.brand && <p className="mt-0.5 text-xs text-gray-500">{p.brand}</p>}
                {p.manufacturer && (
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                    {p.manufacturer}
                  </p>
                )}
                <div className="mt-auto pt-3">
                  {priceNum && priceNum > 0 ? (
                    <p className="text-base font-bold text-primary">{YER.format(priceNum)}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">السعر غير محدد</p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: Math.min(pages, 20) }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setSearch({ page: p })}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                p === search.page
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
