import { createFileRoute, Link } from '@tanstack/react-router'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useDeferredValue, useState } from 'react'
import { Search, Package, CircleCheck, CircleX, Lock } from 'lucide-react'
import { searchStoreProducts, getUniqueSuppliers } from '@/lib/store.functions'

export const Route = createFileRoute('/_authenticated/store')({
  head: () => ({
    meta: [
      { title: 'المتجر — صيدلية المصلي' },
      { name: 'description', content: 'تصفح كامل المخزون بالأسعار والموردين مع فلترة سريعة.' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: StorePage,
})

function StorePage() {
  const [rawQuery, setRawQuery] = useState('')
  const [supplier, setSupplier] = useState('')
  const [sort, setSort] = useState<'name_asc' | 'price_asc' | 'price_desc' | 'stock_desc'>('name_asc')
  const query = useDeferredValue(rawQuery)

  const searchFn = useServerFn(searchStoreProducts)
  const suppliersFn = useServerFn(getUniqueSuppliers)

  const { data: suppliers = [] } = useQuery({
    queryKey: ['store', 'suppliers'],
    queryFn: () => suppliersFn(),
    staleTime: 5 * 60_000,
  })

  const list = useInfiniteQuery({
    queryKey: ['store', 'products', query, supplier, sort],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      searchFn({
        data: {
          query: query || undefined,
          supplier: supplier || undefined,
          sort,
          page: pageParam as number,
          limit: 20,
        },
      }),
    getNextPageParam: (last) => last.nextPage,
    staleTime: 30_000,
  })

  const items = list.data?.pages.flatMap((p) => p.items) ?? []
  const total = list.data?.pages[0]?.total ?? 0

  return (
    <div dir="rtl" className="max-w-[1400px] mx-auto p-4 md:p-8 pt-24 space-y-5">
      <header className="flex items-center gap-3 flex-wrap">
        <Package className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">المتجر</h1>
        <span className="text-sm text-muted-foreground">{total} صنف</span>
        <Link to="/inventory-chat" className="mr-auto text-sm text-primary hover:underline">
          اسأل مساعد المخزون ←
        </Link>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_260px_180px] gap-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full border rounded-xl pr-10 pl-3 py-2 bg-background"
            placeholder="ابحث بالاسم أو الكود أو الباركود…"
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
          />
        </div>
        <select
          className="border rounded-xl px-3 py-2 bg-background"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
        >
          <option value="">كل الموردين</option>
          {suppliers.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          className="border rounded-xl px-3 py-2 bg-background"
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
        >
          <option value="name_asc">الاسم أ–ي</option>
          <option value="price_asc">السعر ↑</option>
          <option value="price_desc">السعر ↓</option>
          <option value="stock_desc">الرصيد ↓</option>
        </select>
      </div>

      {list.isLoading ? (
        <div className="py-16 text-center text-muted-foreground">جاري التحميل…</div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">لا توجد نتائج مطابقة.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((it) => (
            <ProductCard key={`${it.id ?? it.store_code}`} item={it} />
          ))}
        </div>
      )}

      {list.hasNextPage && (
        <div className="flex justify-center pt-4">
          <button
            onClick={() => list.fetchNextPage()}
            disabled={list.isFetchingNextPage}
            className="px-5 py-2 rounded-xl border bg-background hover:bg-primary/5 text-sm"
          >
            {list.isFetchingNextPage ? 'جاري التحميل…' : 'تحميل المزيد'}
          </button>
        </div>
      )}
    </div>
  )
}

function ProductCard({ item }: { item: import('@/lib/store.functions').StoreProductRow }) {
  const inStock = Number(item.stock_balance ?? 0) > 0
  const price = item.price != null ? Number(item.price).toLocaleString('ar-EG') : null
  const detailCode = item.store_code
  return (
    <div className="group border rounded-2xl overflow-hidden bg-background hover:shadow-md transition">
      <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name ?? ''}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <Package className="w-12 h-12 text-muted-foreground/50" />
        )}
      </div>
      <div className="p-3 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold line-clamp-2">{item.name ?? '—'}</p>
          {item.requires_prescription && (
            <span title="يتطلب وصفة" className="shrink-0 text-amber-600">
              <Lock className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground truncate">
          {item.supplier_name_text ?? '—'} · {item.pack_unit ?? '—'}
        </p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm font-bold text-primary">
            {price ? `${price} ر.ي` : '—'}
          </span>
          <span className={`inline-flex items-center gap-1 text-[11px] ${inStock ? 'text-emerald-600' : 'text-rose-600'}`}>
            {inStock ? <CircleCheck className="w-3.5 h-3.5" /> : <CircleX className="w-3.5 h-3.5" />}
            {inStock ? 'متوفر' : 'غير متوفر'}
          </span>
        </div>
        {detailCode && (
          <Link
            to="/store/$code"
            params={{ code: detailCode }}
            className="mt-1 block text-center text-xs py-1.5 rounded-lg border hover:bg-primary/5"
          >
            عرض التفاصيل
          </Link>
        )}
      </div>
    </div>
  )
}
