import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Package, Pill } from 'lucide-react'
import { ProductImage } from '@/components/store/ProductImage'
import { z } from 'zod'
import { listProducts } from '@/lib/catalog.functions'

const searchSchema = z.object({ q: z.string().optional() })

export const Route = createFileRoute('/search')({
  validateSearch: (raw) => searchSchema.parse(raw),
  head: () => ({
    meta: [
      { title: 'البحث — صيدلية المصلي' },
      {
        name: 'description',
        content: 'ابحث عن الأدوية والمنتجات الصحية والخدمات في صيدلية المصلي.',
      },
      { property: 'og:title', content: 'البحث — صيدلية المصلي' },
      { property: 'og:url', content: 'https://muslly.com/search' },
    ],
    links: [{ rel: 'canonical', href: 'https://muslly.com/search' }],
  }),
  component: SearchPage,
})

const SERVICES: Array<{ label: string; desc: string; to: string; keywords: string[] }> = [
  { label: 'مسح الوصفة الطبية', desc: 'التقط صورة وسنقرأها تلقائياً', to: '/vision-lab', keywords: ['وصفة', 'مسح', 'صور', 'prescription'] },
  { label: 'استشارة صيدلانية', desc: 'تحدث مع مساعد الذكاء الصناعي', to: '/ai-chat', keywords: ['استشارة', 'سؤال', 'صيدلي', 'chat'] },
  { label: 'طلب توصيل دواء', desc: 'نموذج طلب دواء إلى منزلك', to: '/request', keywords: ['توصيل', 'طلب', 'دواء', 'delivery'] },
  { label: 'من نحن', desc: 'تعرف على صيدلية المصلي', to: '/about', keywords: ['عن', 'نحن', 'صيدلية', 'about'] },
  { label: 'تواصل معنا', desc: 'الهاتف والعنوان وساعات العمل', to: '/contact', keywords: ['تواصل', 'هاتف', 'عنوان', 'contact'] },
]

function SearchPage() {
  const { q: initial } = Route.useSearch()
  const navigate = useNavigate()
  const [q, setQ] = useState(initial ?? '')
  const query = (initial ?? '').trim()

  const { data, isFetching } = useQuery({
    queryKey: ['search-products', query],
    queryFn: () =>
      listProducts({
        data: { search: query, page: 1, pageSize: 24, publicOnly: true },
      }),
    enabled: query.length >= 2,
    staleTime: 30_000,
  })

  const products = data?.items ?? []
  const services = query.length
    ? SERVICES.filter((s) =>
        [s.label, s.desc, ...s.keywords].some((k) =>
          k.toLowerCase().includes(query.toLowerCase()),
        ),
      )
    : SERVICES

  return (
    <div dir="rtl" className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-4 text-2xl font-black text-gray-900 md:text-3xl">البحث في الموقع</h1>

      <form
        className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-white p-2 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault()
          navigate({ to: '/search', search: { q: q.trim() || undefined } })
        }}
      >
        <Search className="mx-2 h-5 w-5 text-primary" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث عن دواء، خدمة، منتج..."
          className="flex-1 bg-transparent px-2 py-2 text-sm outline-none"
        />
        <button
          type="submit"
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
        >
          بحث
        </button>
      </form>

      {query.length > 0 && query.length < 2 && (
        <p className="mt-6 text-sm text-gray-500">اكتب حرفين على الأقل للبحث.</p>
      )}

      {/* Services */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-gray-900">الخدمات المطابقة</h2>
        {services.length === 0 ? (
          <p className="text-sm text-gray-500">لا توجد خدمة مطابقة.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <Link
                key={s.to}
                to={s.to}
                className="rounded-2xl border border-primary/10 bg-white p-4 transition hover:border-primary/30 hover:shadow-sm"
              >
                <div className="mb-2 flex items-center gap-2 text-primary">
                  <Package className="h-4 w-4" />
                  <span className="font-semibold text-gray-900">{s.label}</span>
                </div>
                <p className="text-xs text-gray-600">{s.desc}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Products */}
      <section className="mt-10">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
          <Pill className="h-5 w-5 text-primary" />
          الأدوية والمنتجات {query && `(${products.length})`}
        </h2>
        {query.length < 2 ? (
          <p className="text-sm text-gray-500">اكتب اسم دواء لعرض النتائج.</p>
        ) : isFetching ? (
          <p className="text-sm text-gray-500">جاري البحث...</p>
        ) : products.length === 0 ? (
          <div className="rounded-2xl bg-white/70 p-6 text-center text-sm text-gray-500">
            لا توجد نتائج مطابقة. جرّب اسماً آخر أو
            <Link to="/request" className="mx-1 text-primary underline">
              اطلب الدواء
            </Link>
            وسنوفره لك.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <Link
                key={p.id}
                to="/product/$productId"
                params={{ productId: p.id }}
                className="group flex gap-3 rounded-2xl border border-primary/10 bg-white p-3 transition hover:border-primary/30 hover:shadow-sm"
              >
                <ProductImage
                  product={p}
                  alt={p.name_ar ?? 'منتج'}
                  rounded="rounded-xl"
                  className="h-20 w-20 shrink-0"
                />
                <div className="min-w-0">
                <p className="font-semibold text-gray-900">{p.name_ar}</p>
                {p.name_en && <p className="text-xs text-gray-500">{p.name_en}</p>}
                {p.brand && (
                  <p className="mt-1 text-xs text-primary/80">{p.brand}</p>
                )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
