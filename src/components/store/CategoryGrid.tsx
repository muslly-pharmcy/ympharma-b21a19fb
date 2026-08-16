import { motion } from 'framer-motion'
import {
  Layers,
  Stethoscope,
  Pill,
  Droplets,
  Baby,
  Leaf,
  FlaskConical,
  HeartPulse,
  Smile,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

export interface StoreCategory {
  id: string
  label: string
}

interface CategoryGridProps {
  categories: StoreCategory[]
  activeCategoryId?: string | undefined
  onSelect: (id: string | undefined) => void
}

const THEMES: Array<{ Icon: LucideIcon; glow: string; tint: string }> = [
  { Icon: Stethoscope, glow: 'from-sky-400/40 via-cyan-400/25 to-teal-400/30', tint: 'text-sky-600' },
  { Icon: Pill, glow: 'from-emerald-400/40 via-teal-400/25 to-lime-400/30', tint: 'text-emerald-600' },
  { Icon: Droplets, glow: 'from-fuchsia-400/35 via-pink-400/25 to-rose-400/30', tint: 'text-fuchsia-600' },
  { Icon: Baby, glow: 'from-indigo-400/35 via-sky-400/25 to-violet-400/30', tint: 'text-indigo-600' },
  { Icon: Leaf, glow: 'from-lime-400/35 via-emerald-400/25 to-green-400/30', tint: 'text-lime-600' },
  { Icon: FlaskConical, glow: 'from-amber-400/35 via-orange-400/25 to-yellow-400/30', tint: 'text-amber-600' },
  { Icon: HeartPulse, glow: 'from-rose-400/35 via-red-400/25 to-orange-400/30', tint: 'text-rose-600' },
  { Icon: Smile, glow: 'from-cyan-400/35 via-blue-400/25 to-indigo-400/30', tint: 'text-cyan-600' },
]

const KEYWORD_ICON: Array<[string[], LucideIcon]> = [
  [['برد', 'سعال', 'انفلونزا', 'تنفس', 'cold', 'respir'], Stethoscope],
  [['مسكن', 'ألم', 'الم', 'حرارة', 'pain', 'analg'], Pill],
  [['بشرة', 'جلد', 'عناية', 'تجميل', 'skin', 'derma', 'cosmet'], Droplets],
  [['طفل', 'أطفال', 'الأم', 'رضع', 'baby', 'child', 'mother'], Baby],
  [['فيتامين', 'مكمل', 'vitamin', 'supplement'], Leaf],
  [['مضاد', 'حيوي', 'antibio', 'إسعاف', 'اسعاف'], FlaskConical],
  [['قلب', 'ضغط', 'سكر', 'هضمي', 'heart', 'diabet', 'cardio'], HeartPulse],
  [['أسنان', 'فم', 'dental', 'oral'], Smile],
]

function themeFor(label: string, index: number) {
  const lower = label.toLowerCase()
  const hit = KEYWORD_ICON.find(([words]) => words.some((w) => lower.includes(w.toLowerCase())))
  const base = THEMES[index % THEMES.length]!
  return { Icon: hit ? hit[1] : base.Icon, glow: base.glow, tint: base.tint }
}

export function CategoryGrid({ categories, activeCategoryId, onSelect }: CategoryGridProps) {
  if (categories.length === 0) return null

  return (
    <section dir="rtl" className="px-4 pb-2 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-2 flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h2 className="text-base font-black text-foreground sm:text-lg">تصفّح الأقسام</h2>
        </div>

        {/* single-line horizontal rail — compact pills, no wrapping */}
        <div className="-mx-1 flex snap-x snap-mandatory flex-nowrap gap-2 overflow-x-auto overscroll-x-contain px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <CategoryPill
            Icon={Sparkles}
            glow="from-teal-400/40 via-emerald-400/25 to-cyan-400/30"
            tint="text-teal-600"
            label="كل الأقسام"
            active={!activeCategoryId}
            onClick={() => onSelect(undefined)}
          />
          {categories.map((c, i) => {
            const t = themeFor(c.label, i)
            return (
              <CategoryPill
                key={c.id}
                Icon={t.Icon}
                glow={t.glow}
                tint={t.tint}
                label={c.label}
                active={activeCategoryId === c.id}
                onClick={() => onSelect(activeCategoryId === c.id ? undefined : c.id)}
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}

function CategoryPill({
  Icon,
  glow,
  tint,
  label,
  active,
  onClick,
}: {
  Icon: LucideIcon
  glow: string
  tint: string
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      aria-pressed={active}
      className={`relative isolate flex h-10 shrink-0 snap-start items-center gap-2 overflow-hidden whitespace-nowrap rounded-full border px-3 text-xs font-bold shadow-sm backdrop-blur-xl transition ${
        active
          ? 'border-primary/50 bg-primary/10 text-primary'
          : 'border-white/40 bg-white/80 text-foreground dark:border-white/10 dark:bg-slate-900/70'
      }`}
    >
      <span
        className={`pointer-events-none absolute -top-6 right-2 -z-10 h-14 w-14 rounded-full bg-gradient-to-br ${glow} blur-2xl`}
      />
      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-primary' : tint}`} strokeWidth={1.9} />
      <span className="max-w-[9rem] truncate">{label}</span>
    </motion.button>
  )
}


export default CategoryGrid
