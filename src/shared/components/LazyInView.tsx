import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  rootMargin?: string
  minHeight?: number
}

/**
 * Renders `children` only once the wrapper enters the viewport.
 * Used to defer heavy components (3D scenes, maps) until the user
 * actually scrolls to them, keeping them out of the initial critical path.
 */
export function LazyInView({ children, fallback = null, rootMargin = '200px', minHeight = 400 }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (visible || typeof IntersectionObserver === 'undefined') return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visible, rootMargin])

  return (
    <div ref={ref} style={{ minHeight: visible ? undefined : minHeight }}>
      {visible ? children : fallback}
    </div>
  )
}
