import { AnimatePresence, motion } from 'framer-motion'
import { Link } from '@tanstack/react-router'
import { X, Sparkles, MessageCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

const KEY = 'engage:exit-intent'

/**
 * Glass modal shown once per session when the pointer leaves through the top
 * of the viewport (desktop) or on a fast upward flick (touch), offering the
 * clinical tools hub and the AI pharmacist instead of a silent bounce.
 */
export function ExitIntentModal() {
  const [open, setOpen] = useState(false)
  const [used, setUsed] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const already = window.sessionStorage.getItem(KEY) === '1'
    setUsed(already)
    if (already) return

    let armed = false
    const armTimer = window.setTimeout(() => {
      armed = true
    }, 15000)

    const fire = () => {
      if (!armed) return
      setOpen(true)
      setUsed(true)
      try {
        window.sessionStorage.setItem(KEY, '1')
      } catch {
        /* storage blocked — session flag stays in memory */
      }
      cleanup()
    }

    const onMouseOut = (e: MouseEvent) => {
      if (e.relatedTarget === null && e.clientY <= 4) fire()
    }

    let lastY = 0
    let lastT = 0
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      const now = performance.now()
      const dt = now - lastT
      if (lastT && dt > 0 && dt < 120) {
        const velocity = (t.clientY - lastY) / dt
        if (velocity > 2.2 && window.scrollY < 80) fire()
      }
      lastY = t.clientY
      lastT = now
    }

    function cleanup() {
      window.clearTimeout(armTimer)
      document.removeEventListener('mouseout', onMouseOut)
      window.removeEventListener('touchmove', onTouchMove)
    }

    document.addEventListener('mouseout', onMouseOut)
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    return cleanup
  }, [])

  if (used && !open) return null

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            aria-label="إغلاق"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm"
          />
          <motion.div
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label="عرض قبل المغادرة"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 240, damping: 24 }}
            className="glass-card relative w-full max-w-md p-6 text-center"
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="إغلاق"
              className="press-scale absolute left-3 top-3 rounded-full p-1.5 text-gray-400 hover:bg-white/60 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="h-6 w-6" aria-hidden />
            </span>
            <h2 className="text-lg font-black text-gray-900">قبل أن تغادر…</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-7 text-gray-600">
              جرّب أدواتنا الطبية المجانية: حاسبة جرعات الأطفال، فاحص التداخلات الدوائية، ومرشد
              الأعراض — أو اسأل الصيدلي الذكي مباشرة.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link
                to="/tools"
                onClick={() => setOpen(false)}
                className="press-scale rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white"
              >
                استكشف الأدوات المجانية
              </Link>
              <Link
                to="/ai-chat"
                onClick={() => setOpen(false)}
                className="press-scale inline-flex items-center gap-1.5 rounded-xl border border-primary/25 bg-white/70 px-4 py-2.5 text-xs font-bold text-primary"
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                اسأل الصيدلي الذكي
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
