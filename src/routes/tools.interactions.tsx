import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { AnimatePresence, motion } from 'framer-motion'
import { Network, Plus, X, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react'
import { checkIngredientInteractions, type IngredientWarning } from '@/lib/tools.functions'
import { Reveal } from '@/shared/components/motion/Reveal'

export const Route = createFileRoute('/tools/interactions')({
  head: () => {
    const title = 'فاحص التداخلات الدوائية — صيدلية المصلي'
    const description =
      'أدخل المواد الفعالة لأدويتك واعرض شدة التداخلات المحتملة بشارات واضحة مبنية على قاعدة المعرفة الدوائية لدينا.'
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary' },
      ],
      links: [{ rel: 'canonical', href: 'https://muslly.com/tools/interactions' }],
    }
  },
  component: InteractionsTool,
})

const SEVERITY_UI: Record<
  IngredientWarning['severity'],
  { label: string; className: string }
> = {
  critical: { label: 'خطورة عالية جداً', className: 'bg-red-100 text-red-700 border-red-200' },
  high: { label: 'خطورة عالية', className: 'bg-red-50 text-red-600 border-red-200' },
  moderate: { label: 'خطورة متوسطة', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  low: { label: 'خطورة منخفضة', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  info: { label: 'معلومة', className: 'bg-sky-50 text-sky-700 border-sky-200' },
}

function InteractionsTool() {
  const [items, setItems] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const check = useServerFn(checkIngredientInteractions)

  const mutation = useMutation({
    mutationFn: (ingredients: string[]) => check({ data: { ingredients } }),
  })

  const add = () => {
    const value = draft.trim()
    if (!value || items.includes(value) || items.length >= 12) return
    setItems([...items, value])
    setDraft('')
    mutation.reset()
  }

  const remove = (value: string) => {
    setItems(items.filter((i) => i !== value))
    mutation.reset()
  }

  const warnings = mutation.data?.warnings ?? []
  const ran = mutation.isSuccess

  return (
    <div dir="rtl" className="mx-auto max-w-2xl px-4 py-10">
      <Reveal className="mb-6 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <Network className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="text-fluid-title font-black text-gray-900">فاحص التداخلات الدوائية</h1>
        <p className="mt-2 text-sm text-gray-600">
          أضف مادتين فعّالتين أو أكثر لعرض التداخلات الموثّقة في قاعدة معرفتنا الدوائية.
        </p>
      </Reveal>

      <div className="glass-card p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
          className="flex items-center gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="مثال: وارفارين، أسبرين، أوميبرازول…"
            className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-primary"
            aria-label="اسم المادة الفعالة"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="إضافة"
            className="press-scale flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <motion.span
                key={item}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-white/70 px-3 py-1 text-xs font-semibold text-primary backdrop-blur"
              >
                {item}
                <button
                  onClick={() => remove(item)}
                  aria-label={`إزالة ${item}`}
                  className="rounded-full p-0.5 hover:bg-primary/10"
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>

        <button
          onClick={() => mutation.mutate(items)}
          disabled={items.length < 2 || mutation.isPending}
          className="press-scale mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          فحص التداخلات
        </button>
        {items.length < 2 && (
          <p className="mt-2 text-center text-[11px] text-gray-500">أضف مادتين على الأقل للفحص.</p>
        )}
      </div>

      {ran && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-5 space-y-3"
        >
          {warnings.length === 0 ? (
            <div className="glass-card flex items-start gap-3 p-5">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
              <div>
                <p className="text-sm font-bold text-gray-900">لا توجد تداخلات موثّقة لدينا</p>
                <p className="mt-1 text-xs leading-6 text-gray-600">
                  عدم وجود نتيجة لا يعني الأمان المطلق — قد لا تكون المادة مُفهرسة بعد. راجع
                  الصيدلي قبل الجمع بين الأدوية.
                </p>
              </div>
            </div>
          ) : (
            warnings.map((w) => {
              const ui = SEVERITY_UI[w.severity]
              return (
                <div key={w.code} className="glass-card p-5">
                  <span
                    className={`mb-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${ui.className}`}
                  >
                    <AlertTriangle className="h-3 w-3" aria-hidden />
                    {ui.label}
                  </span>
                  <p className="text-sm leading-7 text-gray-800">{w.message}</p>
                </div>
              )
            })
          )}
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            <Link
              to="/ai-chat"
              className="press-scale rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white"
            >
              ناقش النتيجة مع الصيدلي الذكي
            </Link>
            <Link
              to="/tools/schedule"
              className="press-scale rounded-xl border border-primary/25 bg-white/70 px-4 py-2 text-xs font-semibold text-primary"
            >
              نظّم مواعيد الجرعات
            </Link>
          </div>
        </motion.div>
      )}

      {mutation.isError && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-center text-xs text-red-700">
          تعذّر إجراء الفحص الآن. حاول مرة أخرى بعد قليل.
        </p>
      )}
    </div>
  )
}
