import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

interface RevealProps {
  children: ReactNode
  className?: string
  delay?: number
  /** distance in px the element travels up on entry */
  y?: number
  once?: boolean
  as?: 'div' | 'section' | 'li'
}

/**
 * Shared entrance primitive: fade + slide-up with spring physics,
 * triggered when the element scrolls into view. Fully disabled for
 * users who prefer reduced motion.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
  once = true,
  as = 'div',
}: RevealProps) {
  const reduce = useReducedMotion()
  const MotionTag = motion[as]

  if (reduce) {
    const Tag = as
    return <Tag className={className}>{children}</Tag>
  }

  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.15, margin: '0px 0px -80px 0px' }}
      transition={{ type: 'spring', stiffness: 120, damping: 20, mass: 0.6, delay }}
    >
      {children}
    </MotionTag>
  )
}

interface StaggerProps {
  children: ReactNode
  className?: string
  /** seconds between each child */
  step?: number
  delay?: number
}

/** Container that staggers its <RevealItem> children on scroll-in. */
export function Stagger({ children, className, step = 0.07, delay = 0 }: StaggerProps) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.1, margin: '0px 0px -60px 0px' }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: step, delayChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  )
}

/** Child of <Stagger>. */
export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>

  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 22 },
        show: {
          opacity: 1,
          y: 0,
          transition: { type: 'spring', stiffness: 130, damping: 18, mass: 0.6 },
        },
      }}
    >
      {children}
    </motion.div>
  )
}
