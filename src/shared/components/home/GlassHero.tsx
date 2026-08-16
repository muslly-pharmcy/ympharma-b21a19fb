import { Link } from '@tanstack/react-router'
import { motion, useReducedMotion } from 'framer-motion'
import { AmbientBackdrop } from '@/shared/components/AmbientBackdrop'
import { GlassLogo } from '@/shared/components/GlassLogo'
import almoslyLogo from '@/assets/almosly-logo-optimized.webp'

const spring = { type: 'spring', stiffness: 260, damping: 20 } as const

/** Meta-style glassmorphic hero with a live WebGL ambient backdrop. */
export function GlassHero() {
  const reduce = useReducedMotion()
  const hover = reduce ? undefined : { scale: 1.03 }
  const tap = reduce ? undefined : { scale: 0.96 }

  return (
    <section className="relative mb-10 overflow-hidden rounded-[2rem]">
      <AmbientBackdrop />

      <motion.div
        className="glass-hero relative px-6 py-10 md:px-12 md:py-14"
        initial={reduce ? false : { opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 110, damping: 20 }}
      >
        <div className="relative grid items-center gap-8 md:grid-cols-[auto_minmax(0,1fr)]">
          <GlassLogo
            src={almoslyLogo}
            alt="صيدلية المصلي — Almosly Pharmacy"
            className="mx-auto h-32 w-32 md:h-44 md:w-44"
          />

          <div className="text-center md:text-right">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/50 px-3 py-1 text-xs font-medium text-primary backdrop-blur-md">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              رعاية دوائية موثوقة · عدن
            </span>

            <h1 className="mt-3 text-fluid-hero font-black leading-[1.1] tracking-tight text-gray-900">
              صيدلية <span className="text-gradient">المصلي</span>
            </h1>
            <p className="mt-1 text-lg font-semibold tracking-wide text-primary/80">
              Almosly Pharmacy
            </p>
            <p className="mx-auto mt-4 max-w-xl text-fluid-body leading-relaxed text-gray-700 md:mx-0">
              صيدلية ذكية تجمع بين المراجعة الصيدلية وأدوات معلومات مساندة — مراجعة الوصفات،
              تأكيد التوفر، وطلب توصيل الأدوية.
            </p>

            <div className="mt-7 flex flex-wrap justify-center gap-3 md:justify-start">
              <motion.div whileHover={hover} whileTap={tap} transition={spring}>
                <Link
                  to="/shop"
                  search={{ page: 1 }}
                  className="pulse-glow inline-flex rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/25"
                >
                  تسوّق الأدوية
                </Link>
              </motion.div>

              <motion.div whileHover={hover} whileTap={tap} transition={spring}>
                <Link
                  to="/ai-chat"
                  className="inline-flex rounded-2xl border border-primary/25 bg-white/55 px-6 py-3 text-sm font-bold text-primary backdrop-blur-xl transition hover:bg-white/75"
                >
                  استشارة ذكية
                </Link>
              </motion.div>

              <motion.div whileHover={hover} whileTap={tap} transition={spring}>
                <Link
                  to="/about"
                  className="inline-flex rounded-2xl px-5 py-3 text-sm font-semibold text-gray-700 transition hover:text-primary"
                >
                  من نحن ←
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}

export default GlassHero
