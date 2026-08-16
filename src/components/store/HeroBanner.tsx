import { motion } from 'framer-motion'
import { Link } from '@tanstack/react-router'
import { Search, Sparkles, X } from 'lucide-react'

export interface HeroCategory {
  id: string
  label: string
}

interface HeroBannerProps {
  search: string
  onSearchChange: (v: string) => void
  categories: HeroCategory[]
  activeCategoryId?: string | undefined
  onCategoryChange: (id: string | undefined) => void
  onUploadRx: () => void
  resultCount?: number | undefined
}

const TRUST_BADGES = [
  '⚡ التوصيل حسب المنطقة والتوفر',
  '👨‍⚕️ إرشاد دوائي مساند',
  '🛡️ تحقق صيدلي قبل التسليم',
] as const

export function HeroBanner({
  search,
  onSearchChange,
  categories,
  activeCategoryId,
  onCategoryChange,
  onUploadRx,
  resultCount,
}: HeroBannerProps) {
  return (
    <section dir="rtl" className="relative px-4 pb-8 pt-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
          className="relative isolate overflow-hidden rounded-[2rem] border border-white/30 bg-gradient-to-r from-emerald-600/10 via-teal-500/10 to-cyan-500/10 p-6 shadow-2xl backdrop-blur-xl sm:p-10 dark:border-white/10"
        >
          {/* animated mesh gradient blobs */}
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="mesh-drift absolute -right-16 -top-24 h-72 w-72 rounded-full bg-emerald-400/30 blur-3xl" />
            <div
              className="mesh-drift absolute -left-20 top-10 h-80 w-80 rounded-full bg-cyan-400/25 blur-3xl"
              style={{ animationDelay: '-6s' }}
            />
            <div
              className="mesh-drift absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-teal-300/25 blur-3xl"
              style={{ animationDelay: '-11s' }}
            />
          </div>

          <p className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/60 px-3 py-1 text-xs font-semibold text-primary shadow-sm backdrop-blur-md dark:bg-slate-900/50">
            <Sparkles className="h-3.5 w-3.5" /> صيدلية إلكترونية موثوقة
          </p>

          <h1 className="mt-4 text-3xl font-black leading-tight text-foreground sm:text-5xl">
            صيدلية المصلي — <span className="bg-gradient-to-l from-primary via-teal-600 to-cyan-600 bg-clip-text text-transparent">دواؤك يصلك بثقة</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            تصفّح المنتجات المتاحة وارفع وصفتك، مع مراجعة صيدلية وتأكيد السعر وموعد
            التوصيل قبل إتمام الطلب.
          </p>

          {/* 3D search bar */}
          <motion.div
            whileHover={{ y: -3 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="relative mt-6 max-w-2xl"
          >
            <div className="absolute inset-0 -z-10 translate-y-2 rounded-2xl bg-primary/20 blur-xl" />
            <Search className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="ابحث عن دواء، مادة فعالة، أو علامة تجارية…"
              aria-label="بحث عن منتج"
              className="w-full rounded-2xl border border-white/50 bg-white/80 py-4 pr-12 pl-11 text-sm font-medium text-foreground shadow-[0_18px_40px_-18px_rgba(0,93,79,0.55)] outline-none backdrop-blur-xl transition focus:border-primary focus:ring-2 focus:ring-primary/25 dark:border-white/10 dark:bg-slate-900/70"
            />
            {search.length > 0 && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="مسح البحث"
                className="absolute left-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-foreground/10 text-foreground/70 transition hover:bg-foreground/20"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {search.length > 0 && typeof resultCount === 'number' && (
              <p className="mt-2 pr-1 text-xs font-semibold text-muted-foreground">
                {resultCount > 0 ? `${resultCount} نتيجة مطابقة` : 'لا توجد نتائج — جرّب كلمة أخرى'}
              </p>
            )}
          </motion.div>

          {/* instant category pills */}
          {categories.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              <PillButton active={!activeCategoryId} onClick={() => onCategoryChange(undefined)}>
                الكل
              </PillButton>
              {categories.slice(0, 8).map((c) => (
                <PillButton
                  key={c.id}
                  active={activeCategoryId === c.id}
                  onClick={() => onCategoryChange(activeCategoryId === c.id ? undefined : c.id)}
                >
                  {c.label}
                </PillButton>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              to="/shop"
              search={{ page: 1 }}
              className="press-scale rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25"
            >
              تسوّق الآن
            </Link>
            <button
              onClick={onUploadRx}
              className="press-scale rounded-2xl border border-primary/30 bg-white/70 px-5 py-2.5 text-sm font-bold text-primary backdrop-blur-md dark:bg-slate-900/50"
            >
              رفع الوصفة الطبية
            </button>
            <Link
              to="/tools"
              className="press-scale rounded-2xl border border-white/50 bg-white/60 px-5 py-2.5 text-sm font-bold text-foreground backdrop-blur-md dark:border-white/10 dark:bg-slate-900/50"
            >
              الأدوات الصحية
            </Link>
          </div>

          {/* floating trust badges */}
          <div className="mt-6 flex flex-wrap gap-2">
            {TRUST_BADGES.map((b, i) => (
              <motion.span
                key={b}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08, type: 'spring', stiffness: 200, damping: 18 }}
                whileHover={{ y: -3 }}
                className="rounded-full border border-white/50 bg-white/70 px-4 py-2 text-xs font-bold text-foreground shadow-[0_12px_28px_-16px_rgba(0,93,79,0.7)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60"
              >
                {b}
              </motion.span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      className={`rounded-full px-4 py-2 text-xs font-bold backdrop-blur-md transition ${
        active
          ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
          : 'border border-white/50 bg-white/60 text-foreground dark:border-white/10 dark:bg-slate-900/50'
      }`}
    >
      {children}
    </motion.button>
  )
}

export default HeroBanner
