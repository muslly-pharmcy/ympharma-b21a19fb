import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { LayoutGrid, Pill, Thermometer, HeartPulse, Sparkles, Baby, Droplets, Cross, Stethoscope } from 'lucide-react'
import { listCategories } from '@/lib/catalog.functions'

// Icon + color per known category slug (fallback used for unknowns)
const STYLE_MAP: Record<string, { icon: React.ComponentType<{ className?: string }>; bg: string; color: string }> = {
  'pain-fever': { icon: Thermometer, bg: 'bg-red-50', color: 'text-red-600' },
  'cold-flu': { icon: HeartPulse, bg: 'bg-sky-50', color: 'text-sky-600' },
  'vitamins': { icon: Sparkles, bg: 'bg-amber-50', color: 'text-amber-600' },
  'skin-care': { icon: Droplets, bg: 'bg-pink-50', color: 'text-pink-600' },
  'mother-baby': { icon: Baby, bg: 'bg-purple-50', color: 'text-purple-600' },
  'hygiene': { icon: Cross, bg: 'bg-teal-50', color: 'text-teal-600' },
  'digestive': { icon: Pill, bg: 'bg-green-50', color: 'text-green-600' },
  'first-aid': { icon: Stethoscope, bg: 'bg-orange-50', color: 'text-orange-600' },
}

export default function CategoriesGrid() {
  const { data: categories = [] } = useQuery({
    queryKey: ['home', 'categories'],
    queryFn: () => listCategories(),
    staleTime: 5 * 60_000,
  })

  if (!categories.length) return null

  return (
    <motion.section
      className="mb-10"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <div className="mb-4 flex items-center gap-3">
        <LayoutGrid className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold text-gray-900">تصفح الأقسام</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {categories.slice(0, 8).map((c) => {
          const style = STYLE_MAP[c.slug ?? ''] ?? { icon: Pill, bg: 'bg-primary/10', color: 'text-primary' }
          const Icon = style.icon
          return (
            <Link
              key={c.id}
              to="/shop"
              search={{ page: 1, cat: c.id }}
              className="glass-panel rounded-2xl p-4 text-center transition hover:scale-[1.03]"
            >
              <div className={`mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl ${style.bg}`}>
                <Icon className={`h-5 w-5 ${style.color}`} />
              </div>
              <p className="text-sm font-bold text-gray-900">{c.name_ar}</p>
              {c.name_en && <p className="mt-0.5 text-[11px] text-gray-500">{c.name_en}</p>}
            </Link>
          )
        })}
      </div>
    </motion.section>
  )
}
