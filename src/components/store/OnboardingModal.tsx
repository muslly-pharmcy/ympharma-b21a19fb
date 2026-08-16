import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X, ScanLine, Stethoscope, Siren, Zap, ArrowLeft } from 'lucide-react'

const STORAGE_KEY = 'muslly.onboarding.v2'

const STEPS = [
  {
    icon: ScanLine,
    emoji: '🤖',
    title: 'قارئ الروشتات بالذكاء الاصطناعي',
    body: 'صوّر الوصفة الطبية ودع النظام يقرأها ويستخرج الأدوية والجرعات تلقائياً.',
    accent: 'from-sky-500/25 to-cyan-400/10',
  },
  {
    icon: Stethoscope,
    emoji: '🩺',
    title: 'المرجع الفارماكولوجي والبدائل',
    body: 'استكشف المادة الفعالة، آلية العمل، والبدائل الدوائية المتاحة لكل منتج.',
    accent: 'from-emerald-500/25 to-teal-400/10',
  },
  {
    icon: Siren,
    emoji: '🚨',
    title: 'وضع الطوارئ اللحظي',
    body: 'أولوية قصوى لتجهيز الأدوية العاجلة مع تحديد موقعك وإرسال الطلب فوراً.',
    accent: 'from-red-500/25 to-orange-400/10',
  },
  {
    icon: Zap,
    emoji: '⚡',
    title: 'سرعة فائقة',
    body: 'تصفّح خفيف ومحسّن بالكامل ليعمل بسلاسة على شبكات الإنترنت الضعيفة في عدن.',
    accent: 'from-amber-500/25 to-yellow-400/10',
  },
] as const

/**
 * First-visit guided welcome. Purely client-side (localStorage flag) —
 * no visitor registration, profiling, or network calls.
 */
export function OnboardingModal() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const reduce = useReducedMotion()

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        const t = window.setTimeout(() => setOpen(true), 600)
        return () => window.clearTimeout(t)
      }
    } catch {
      /* storage blocked — stay silent */
    }
    return undefined
  }, [])

  const dismiss = useCallback(() => {
    setOpen(false)
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, dismiss])

  const isLast = step === STEPS.length - 1
  const active = STEPS[step]!

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/30 p-3 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-title"
          dir="rtl"
        >
          <motion.div
            initial={reduce ? { opacity: 0 } : { y: 48, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { y: 28, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="glass-card relative w-full max-w-md overflow-hidden p-5 sm:max-w-lg sm:p-7"
          >
            <button
              onClick={dismiss}
              aria-label="إغلاق"
              className="absolute left-4 top-4 rounded-full p-1.5 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
            >
              <X className="h-4 w-4" />
            </button>

            <p className="text-xs font-semibold tracking-wide text-primary">أهلاً بك في</p>
            <h2 id="onboarding-title" className="mt-1 text-2xl font-black text-foreground sm:text-3xl">
              صيدلية المصلي
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              رعاية دوائية موثوقة في عدن — تصفّح بحرية، بدون تسجيل.
            </p>

            {/* Feature stage — fixed min-height keeps CLS at zero while stepping */}
            <div className="relative mt-5 min-h-[170px] sm:min-h-[150px]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={active.title}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, x: -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                  className={`glass-panel flex gap-3 rounded-2xl bg-gradient-to-bl ${active.accent} p-4 text-right`}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                    <active.icon className="h-6 w-6 text-primary" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-base font-black text-foreground">
                      <span aria-hidden className="ml-1.5">
                        {active.emoji}
                      </span>
                      {active.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{active.body}</p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Dots */}
            <div className="mt-4 flex items-center justify-center gap-2">
              {STEPS.map((s, i) => (
                <button
                  key={s.title}
                  type="button"
                  onClick={() => setStep(i)}
                  aria-label={`الميزة ${i + 1}: ${s.title}`}
                  aria-current={i === step}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === step ? 'w-6 bg-primary' : 'w-2 bg-primary/25 hover:bg-primary/50'
                  }`}
                />
              ))}
            </div>

            <div className="mt-5 flex items-center gap-3">
              {!isLast && (
                <button
                  onClick={dismiss}
                  className="rounded-2xl px-3 py-3 text-sm font-bold text-muted-foreground transition hover:text-foreground"
                >
                  تخطي
                </button>
              )}
              <motion.button
                whileTap={reduce ? undefined : { scale: 0.97 }}
                onClick={() => (isLast ? dismiss() : setStep((s) => s + 1))}
                className="press-scale flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-95"
              >
                {isLast ? 'ابدأ التسوق الآن' : 'التالي'}
                <ArrowLeft className="h-4 w-4" aria-hidden />
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default OnboardingModal
