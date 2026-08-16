import { Suspense, lazy, useEffect, useRef, useState } from 'react'

const AmbientMoleculeField = lazy(() => import('@/shared/3d/AmbientMoleculeField'))

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && canvas.getContext('webgl'))
  } catch {
    return false
  }
}

/**
 * Client-only, viewport-gated WebGL backdrop.
 * Renders nothing (static gradient only) when off-screen, on reduced-motion,
 * on low-end devices, or when WebGL is unavailable.
 */
export function AmbientBackdrop({ className = '' }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [enabled, setEnabled] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const lowEnd =
      (navigator.hardwareConcurrency ?? 8) <= 2 ||
      // @ts-expect-error non-standard but widely available on Android
      (navigator.deviceMemory ?? 8) <= 2
    setEnabled(!reduce && !lowEnd && supportsWebGL())
  }, [])

  useEffect(() => {
    const el = hostRef.current
    if (!el || !enabled) return
    const io = new IntersectionObserver(
      ([entry]) => setVisible(!!entry?.isIntersecting),
      { rootMargin: '120px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [enabled])

  return (
    <div ref={hostRef} className={`pointer-events-none absolute inset-0 ${className}`} aria-hidden>
      {/* static ambient gradient — always present, also the no-WebGL fallback */}
      <div className="absolute inset-0 gradient-glow" />
      <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
      <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-gold/15 blur-3xl" />
      {enabled && visible && (
        <Suspense fallback={null}>
          <AmbientMoleculeField />
        </Suspense>
      )}
    </div>
  )
}

export default AmbientBackdrop
