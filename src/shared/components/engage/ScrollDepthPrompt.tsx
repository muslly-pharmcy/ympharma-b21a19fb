import { AnimatePresence, motion } from 'framer-motion'
import { Link } from '@tanstack/react-router'
import { X, Sparkles, Stethoscope } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useScrollDepth } from '@/hooks/useScrollDepth'

const KEY = 'engage:scroll-prompt'

/**
 * Slide-up glass card shown once per session at 80% scroll depth, offering a
 * clinical tool and a related guide instead of letting the reader drop off.
 */
export function ScrollDepthPrompt({
  shopTerm,
  title = 'قبل أن تغادر…',
}: {
  shopTerm?: string
  title?: string
}) {
  const reached = useScrollDepth(0.8)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setDismissed(window.sessionStorage.getItem(KEY) === '1')
  }, [])

  const close = () => {
    setDismissed(true)
    try {
      window.sessionStorage.setItem(KEY, '1')
    } catch {
      /* storage blocked — dismissal stays in-memory */
    }
  }

  const open = reached && !dismissed

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          dir="rtl"
          role="complementary"
          aria-label={title}
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', stiffness: 220, damping: 26 }}
          className="glass-card safe-area-bottom fixed inset-x-3 bottom-20 z-40 p-4 md:inset-x-auto md:right-6 md:bottom-6 md:w-[380px]"
        >
          <button
            onClick={close}
            aria-label="إغلاق الاقتراح"
            className="press-scale absolute left-3 top-3 rounded-full p-1 text-gray-400 hover:bg-white/60 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="mb-1 pl-6 text-sm font-bold text-gray-900">{title}</p>
          <p className="mb-3 text-xs text-gray-600">
            جرّب أدواتنا الطبية التفاعلية أو تصفّح البدائل المتوفرة بنفس المادة الفعالة.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/tools"
              onClick={close}
              className="press-scale inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white"
            >
              <Stethoscope className="h-3.5 w-3.5" aria-hidden />
              الأدوات الطبية
            </Link>
            {shopTerm ? (
              <Link
                to="/shop"
                search={{ q: shopTerm }}
                onClick={close}
                className="press-scale inline-flex items-center gap-1.5 rounded-xl border border-primary/25 bg-white/70 px-3 py-2 text-xs font-semibold text-primary"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                بدائل متوفرة
              </Link>
            ) : (
              <Link
                to="/ai-chat"
                onClick={close}
                className="press-scale inline-flex items-center gap-1.5 rounded-xl border border-primary/25 bg-white/70 px-3 py-2 text-xs font-semibold text-primary"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                استشارة ذكية
              </Link>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
