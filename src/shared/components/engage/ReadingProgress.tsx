import { motion, useReducedMotion, useScroll, useSpring } from 'framer-motion'

/** Fixed top reading-progress bar for long-form pages. */
export function ReadingProgress() {
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const width = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.4 })

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-1 bg-transparent"
    >
      <motion.div
        className="h-full origin-right bg-gradient-to-l from-primary via-emerald-400 to-gold shadow-[0_0_12px_rgba(0,93,79,0.45)]"
        style={{ scaleX: reduce ? scrollYProgress : width }}
      />
    </div>
  )
}
