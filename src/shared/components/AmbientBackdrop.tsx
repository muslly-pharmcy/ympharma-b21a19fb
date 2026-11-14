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
    // Preserve the glass gradient on mobile without downloading the large
    // React Three Fiber/WebGL chunk on the critical rendering path.
    const wideScreen = window.matchMedia('(min-width: 1024px)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    const lowEnd =
      (navigator.hardwareConcurrency ?? 8) <= 2 ||
      (navigator as Navigator & { deviceMemory?: number }).deviceMemory !== undefined &&
        (navigator as Navigator & { deviceMemory?: number }).deviceMemory! <= 2

    const updateEligibility = () => {
      const allowed = wideScreen.matches && !reducedMotion.matches &&
        !connection?.saveData && !lowEnd
      // Avoid even probing WebGL on mobile, low-end, or reduced-motion devices.
      setEnabled(allowed && supportsWebGL())
    }

    updateEligibility()
    wideScreen.addEventListener('change', updateEligibility)
    reducedMotion.addEventListener('change', updateEligibility)
    return () => {
      wideScreen.removeEventListener('change', updateEligibility)
      reducedMotion.removeEventListener('change', updateEligibility)
    }
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
