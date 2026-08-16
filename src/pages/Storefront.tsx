import { useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { motion } from 'framer-motion'
import { Package, MessageCircle, Sparkles } from 'lucide-react'
import { listProducts, listCategories } from '@/lib/catalog.functions'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { HealthBundles } from '@/components/store/HealthBundles'
import { PrescriptionUploadModal } from '@/components/store/PrescriptionUploadModal'
import { HeroBanner } from '@/components/store/HeroBanner'
import { CategoryGrid } from '@/components/store/CategoryGrid'
import { ProductCard, type StoreProduct } from '@/components/store/ProductCard'
import { Skeleton } from '@/components/skeletons/Skeleton'
import { GlassHero } from '@/shared/components/home/GlassHero'
import CategoriesGrid from '@/shared/components/home/CategoriesGrid'

const gridVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}

export default function Storefront() {
  const [rawSearch, setRawSearch] = useState('')
  const [rxOpen, setRxOpen] = useState(false)
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined)
  const heroRef = useRef<HTMLDivElement | null>(null)

  const search = useDebounce(rawSearch, 300)

  const productsFn = useServerFn(listProducts)
  const categoriesFn = useServerFn(listCategories)

  const { data: categories = [] } = useQuery({
    queryKey: ['storefront', 'categories'],
    queryFn: () => categoriesFn(),
    staleTime: 10 * 60_000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['storefront', 'home-products', search, categoryId],
    queryFn: () =>
      productsFn({
        data: { search: search || undefined, categoryId, page: 1, pageSize: 24 },
      }),
    staleTime: 60_000,
  })

  const products = useMemo(() => (data?.items ?? []) as unknown as StoreProduct[], [data])

  const categoryOptions = useMemo(
    () =>
      categories.map((c) => ({
        id: c.id,
        label: (c.name_ar ?? c.name_en ?? 'قسم') as string,
      })),
    [categories],
  )

  return (
    <div dir="rtl" className="min-h-screen pb-24 md:pb-0">
      <PrescriptionUploadModal open={rxOpen} onClose={() => setRxOpen(false)} />

      <section className="px-4 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <GlassHero />
        </div>
      </section>

      <div ref={heroRef}>
        <HeroBanner
          search={rawSearch}
          onSearchChange={setRawSearch}
          categories={categoryOptions}
          activeCategoryId={categoryId}
          onCategoryChange={setCategoryId}
          onUploadRx={() => setRxOpen(true)}
          resultCount={data?.total ?? products.length}
        />
      </div>

      <CategoryGrid
        categories={categoryOptions}
        activeCategoryId={categoryId}
        onSelect={setCategoryId}
      />

      {/* Products */}
      <section className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-black text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              {search ? 'نتائج البحث' : 'منتجات مختارة'}
            </h2>
            <Link
              to="/shop"
              search={{ page: 1 }}
              className="text-sm font-bold text-primary hover:underline"
            >
              عرض كل المنتجات ←
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-72 rounded-3xl" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-3xl border border-white/30 bg-white/70 py-16 text-center text-muted-foreground shadow-xl backdrop-blur-xl dark:bg-slate-900/70">
              <Package className="mx-auto mb-3 h-10 w-10 opacity-50" />
              لا توجد نتائج مطابقة.
            </div>
          ) : (
            <motion.div
              variants={gridVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
            >
              {products.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </motion.div>
          )}
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <CategoriesGrid />
        </div>
      </section>

      <HealthBundles />

      {/* Consultation CTA */}
      <section className="px-4 pb-14 pt-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ type: 'spring', stiffness: 130, damping: 20 }}
          className="relative isolate mx-auto flex max-w-6xl flex-col items-center gap-4 overflow-hidden rounded-[2rem] border border-white/30 bg-gradient-to-r from-emerald-600/10 via-teal-500/10 to-cyan-500/10 p-8 text-center shadow-2xl backdrop-blur-xl dark:border-white/10"
        >
          <span className="mesh-drift pointer-events-none absolute -top-20 right-1/4 -z-10 h-56 w-56 rounded-full bg-teal-400/25 blur-3xl" />
          <MessageCircle className="h-8 w-8 text-primary" />
          <h2 className="text-xl font-black text-foreground">تحتاج مساعدة في اختيار الدواء؟</h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            أرسل استفسارك للصيدلية لمراجعة الصنف وطريقة الاستخدام والتنبيهات الدوائية.
          </p>
          <Link
            to="/contact"
            className="press-scale rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25"
          >
            تواصل معنا
          </Link>
        </motion.div>
      </section>
    </div>
  )
}
