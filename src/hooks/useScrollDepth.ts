import { useEffect, useState } from 'react'

/**
 * Fires once when the user has scrolled past `threshold` (0..1) of the page.
 * Read-only observation via rAF-throttled scroll — no layout thrash.
 */
export function useScrollDepth(threshold = 0.8): boolean {
  const [reached, setReached] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || reached) return
    let frame = 0

    const measure = () => {
      frame = 0
      const doc = document.documentElement
      const scrollable = doc.scrollHeight - window.innerHeight
      if (scrollable <= 240) return
      const progress = window.scrollY / scrollable
      if (progress >= threshold) setReached(true)
    }

    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(measure)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    measure()
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [threshold, reached])

  return reached
}
