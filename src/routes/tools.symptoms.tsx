import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Stethoscope, ArrowRight, RotateCcw, ShieldAlert, ShoppingBag } from 'lucide-react'
import {
  SYMPTOM_NODES,
  SYMPTOM_OUTCOMES,
  SYMPTOM_ROOT,
  type SymptomOutcome,
} from '@/domain/tools/symptoms'
import { Reveal } from '@/shared/components/motion/Reveal'

export const Route = createFileRoute('/tools/symptoms')({
  head: () => {
    const title = 'مرشد الأعراض التفاعلي — صيدلية المصلي'
    const description =
      'أجب على أسئلة قصيرة واحصل على توصية رعاية ذاتية واضحة مع تنبيهات العلامات الخطرة وروابط للمنتجات المناسبة.'
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary' },
      ],
      links: [{ rel: 'canonical', href: 'https://muslly.com/tools/symptoms' }],
    }
  },
  component: SymptomWizard,
})

const TONE: Record<SymptomOutcome['tone'], string> = {
  safe: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  caution: 'border-amber-200 bg-amber-50 text-amber-800',
  urgent: 'border-red-200 bg-red-50 text-red-800',
}

function SymptomWizard() {
  const [path, setPath] = useState<string[]>([SYMPTOM_ROOT])
  const [outcomeId, setOutcomeId] = useState<string | null>(null)

  const currentId = path[path.length - 1] ?? SYMPTOM_ROOT
  const node = SYMPTOM_NODES[currentId]
  const outcome = outcomeId ? SYMPTOM_OUTCOMES[outcomeId] : null

  const back = () => {
    if (outcomeId) {
      setOutcomeId(null)
      return
    }
    if (path.length > 1) setPath(path.slice(0, -1))
  }

  const restart = () => {
    setPath([SYMPTOM_ROOT])
    setOutcomeId(null)
  }

  return (
    <div dir="rtl" className="mx-auto max-w-2xl px-4 py-10">
      <Reveal className="mb-6 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
          <Stethoscope className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="text-fluid-title font-black text-gray-900">مرشد الأعراض</h1>
        <p className="mt-2 text-sm text-gray-600">
          إرشاد أولي للرعاية الذاتية — ليس تشخيصاً طبياً.
        </p>
      </Reveal>

      <AnimatePresence mode="wait">
        {outcome ? (
          <motion.div
            key={outcome.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="glass-card p-5"
          >
            <div className={`mb-4 rounded-2xl border p-4 ${TONE[outcome.tone]}`}>
              <p className="flex items-center gap-2 text-sm font-bold">
                {outcome.tone === 'urgent' && <ShieldAlert className="h-4 w-4" aria-hidden />}
                {outcome.title}
              </p>
            </div>
            <ul className="space-y-2">
              {outcome.advice.map((line) => (
                <li key={line} className="flex gap-2 text-sm leading-7 text-gray-700">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-wrap gap-2">
              {outcome.shopTerm && (
                <Link
                  to="/shop"
                  search={{ q: outcome.shopTerm }}
                  className="press-scale inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white"
                >
                  <ShoppingBag className="h-3.5 w-3.5" aria-hidden />
                  {outcome.shopLabel ?? 'منتجات ذات صلة'}
                </Link>
              )}
              <Link
                to="/ai-chat"
                className="press-scale rounded-xl border border-primary/25 bg-white/70 px-4 py-2 text-xs font-semibold text-primary"
              >
                استشارة ذكية
              </Link>
              <button
                onClick={restart}
                className="press-scale inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white/70 px-4 py-2 text-xs font-semibold text-gray-600"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                من البداية
              </button>
            </div>

            <p className="mt-4 rounded-xl bg-gray-50 p-3 text-[11px] leading-6 text-gray-500">
              إذا ساءت الأعراض أو ظهرت علامات خطر (ضيق تنفس، ألم صدر، فقدان وعي) توجّه للطوارئ
              فوراً.
            </p>
          </motion.div>
        ) : node ? (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="glass-card p-5"
          >
            <p className="text-base font-bold text-gray-900">{node.question}</p>
            {node.hint && <p className="mt-1 text-xs text-gray-500">{node.hint}</p>}
            <div className="mt-4 space-y-2">
              {node.options.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => {
                    if (opt.outcome) setOutcomeId(opt.outcome)
                    else if (opt.next) setPath([...path, opt.next])
                  }}
                  className="press-scale block w-full rounded-2xl border border-white/60 bg-white/60 p-3 text-right text-sm text-gray-700 transition hover:border-primary/40 hover:bg-white"
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {path.length > 1 && (
              <button
                onClick={back}
                className="press-scale mt-4 inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white/70 px-3 py-2 text-xs font-semibold text-gray-600"
              >
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                رجوع
              </button>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
