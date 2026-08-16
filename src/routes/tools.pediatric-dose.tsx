import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Baby, ArrowRight, ArrowLeft, RotateCcw, AlertTriangle } from 'lucide-react'
import { Reveal } from '@/shared/components/motion/Reveal'

export const Route = createFileRoute('/tools/pediatric-dose')({
  head: () => {
    const title = 'حاسبة جرعات الأطفال — صيدلية المصلي'
    const description =
      'احسب جرعة الدواء الآمنة للأطفال حسب الوزن والعمر والتركيز، مع حد أقصى يومي وتنبيهات السلامة.'
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary' },
      ],
      links: [{ rel: 'canonical', href: 'https://muslly.com/tools/pediatric-dose' }],
    }
  },
  component: PediatricDose,
})

/** Common pediatric oral suspensions available in the pharmacy. */
const DRUGS = [
  {
    id: 'paracetamol',
    label: 'باراسيتامول (خافض حرارة)',
    mgPerKg: 15,
    dosesPerDay: 4,
    maxMgPerKgPerDay: 60,
    maxMgPerDay: 3000,
    concentrations: [
      { label: '120 مجم / 5 مل', mg: 120, ml: 5 },
      { label: '250 مجم / 5 مل', mg: 250, ml: 5 },
    ],
    minAgeMonths: 3,
  },
  {
    id: 'ibuprofen',
    label: 'إيبوبروفين (مسكن ومضاد التهاب)',
    mgPerKg: 10,
    dosesPerDay: 3,
    maxMgPerKgPerDay: 30,
    maxMgPerDay: 1200,
    concentrations: [
      { label: '100 مجم / 5 مل', mg: 100, ml: 5 },
      { label: '200 مجم / 5 مل', mg: 200, ml: 5 },
    ],
    minAgeMonths: 6,
  },
  {
    id: 'amoxicillin',
    label: 'أموكسيسيلين (مضاد حيوي — بوصفة)',
    mgPerKg: 15,
    dosesPerDay: 3,
    maxMgPerKgPerDay: 45,
    maxMgPerDay: 1500,
    concentrations: [
      { label: '125 مجم / 5 مل', mg: 125, ml: 5 },
      { label: '250 مجم / 5 مل', mg: 250, ml: 5 },
    ],
    minAgeMonths: 1,
  },
] as const

type DrugId = (typeof DRUGS)[number]['id']

const STEPS = ['الدواء', 'الوزن والعمر', 'التركيز', 'النتيجة'] as const

function PediatricDose() {
  const [step, setStep] = useState(0)
  const [drugId, setDrugId] = useState<DrugId>('paracetamol')
  const [weight, setWeight] = useState('')
  const [ageMonths, setAgeMonths] = useState('')
  const [concIndex, setConcIndex] = useState(0)

  const drug = DRUGS.find((d) => d.id === drugId) ?? DRUGS[0]
  const weightKg = Number(weight)
  const age = Number(ageMonths)

  const result = useMemo(() => {
    if (!Number.isFinite(weightKg) || weightKg <= 0) return null
    const conc = drug.concentrations[concIndex] ?? drug.concentrations[0]
    const perDoseMg = Math.min(weightKg * drug.mgPerKg, drug.maxMgPerDay / drug.dosesPerDay)
    const perDoseMl = (perDoseMg / conc.mg) * conc.ml
    const dailyMg = Math.min(perDoseMg * drug.dosesPerDay, drug.maxMgPerDay)
    const cappedByMax = weightKg * drug.mgPerKg > drug.maxMgPerDay / drug.dosesPerDay
    return {
      concLabel: conc.label,
      perDoseMg: Math.round(perDoseMg * 10) / 10,
      perDoseMl: Math.round(perDoseMl * 10) / 10,
      dailyMg: Math.round(dailyMg),
      intervalHours: Math.round(24 / drug.dosesPerDay),
      cappedByMax,
    }
  }, [drug, concIndex, weightKg])

  const tooYoung = Number.isFinite(age) && age > 0 && age < drug.minAgeMonths
  const heavyWeightFlag = Number.isFinite(weightKg) && weightKg > 40
  const canNext =
    step === 0 ||
    (step === 1 && weightKg > 0 && weightKg < 120) ||
    step === 2

  const reset = () => {
    setStep(0)
    setWeight('')
    setAgeMonths('')
    setConcIndex(0)
  }

  return (
    <div dir="rtl" className="mx-auto max-w-2xl px-4 py-10">
      <Reveal className="mb-6 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
          <Baby className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="text-fluid-title font-black text-gray-900">حاسبة جرعات الأطفال</h1>
        <p className="mt-2 text-sm text-gray-600">
          نتائج إرشادية تعتمد على الوزن — تأكد دائماً من تعليمات الطبيب أو الصيدلي.
        </p>
      </Reveal>

      <ol className="mb-5 flex items-center justify-between gap-1 text-[11px]">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 flex-col items-center gap-1">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                i <= step ? 'bg-primary text-white' : 'bg-white/70 text-gray-400'
              }`}
            >
              {i + 1}
            </span>
            <span className={i <= step ? 'font-semibold text-primary' : 'text-gray-400'}>
              {label}
            </span>
          </li>
        ))}
      </ol>

      <motion.div layout className="glass-card p-5">
        {step === 0 && (
          <div className="space-y-2">
            <p className="mb-3 text-sm font-bold text-gray-900">اختر الدواء</p>
            {DRUGS.map((d) => (
              <button
                key={d.id}
                onClick={() => setDrugId(d.id)}
                className={`press-scale block w-full rounded-2xl border p-3 text-right text-sm transition ${
                  d.id === drugId
                    ? 'border-primary bg-primary/10 font-bold text-primary'
                    : 'border-white/60 bg-white/60 text-gray-700 hover:bg-white'
                }`}
              >
                {d.label}
                <span className="mt-0.5 block text-[11px] font-normal text-gray-500">
                  {d.mgPerKg} مجم/كجم لكل جرعة · حتى {d.dosesPerDay} جرعات يومياً
                </span>
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-gray-900">وزن الطفل (كجم)</span>
              <input
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value.replace(/[^\d.]/g, ''))}
                placeholder="مثال: 14.5"
                className="w-full rounded-xl border border-gray-200 bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-gray-900">العمر (بالشهور)</span>
              <input
                inputMode="numeric"
                value={ageMonths}
                onChange={(e) => setAgeMonths(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="مثال: 30"
                className="w-full rounded-xl border border-gray-200 bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </label>
            {tooYoung && (
              <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                هذا الدواء غير موصى به عادةً تحت عمر {drug.minAgeMonths} شهر — استشر الطبيب أولاً.
              </p>
            )}
            {heavyWeightFlag && (
              <p className="rounded-xl bg-sky-50 p-3 text-xs text-sky-800">
                الوزن يقترب من جرعة البالغين؛ سيتم تطبيق الحد الأقصى اليومي تلقائياً.
              </p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <p className="mb-3 text-sm font-bold text-gray-900">تركيز الشراب المتوفر لديك</p>
            {drug.concentrations.map((c, i) => (
              <button
                key={c.label}
                onClick={() => setConcIndex(i)}
                className={`press-scale block w-full rounded-2xl border p-3 text-right text-sm transition ${
                  i === concIndex
                    ? 'border-primary bg-primary/10 font-bold text-primary'
                    : 'border-white/60 bg-white/60 text-gray-700 hover:bg-white'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        {step === 3 && result && (
          <div className="space-y-4 text-center">
            <p className="text-xs text-gray-500">{drug.label} · {result.concLabel}</p>
            <div className="rounded-2xl bg-primary/10 p-5">
              <p className="text-4xl font-black text-primary">{result.perDoseMl} مل</p>
              <p className="mt-1 text-sm font-semibold text-gray-700">
                لكل جرعة (≈ {result.perDoseMg} مجم)
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-white/70 p-3">
                <p className="font-bold text-gray-900">كل {result.intervalHours} ساعات</p>
                <p className="text-gray-500">حتى {drug.dosesPerDay} مرات يومياً</p>
              </div>
              <div className="rounded-xl bg-white/70 p-3">
                <p className="font-bold text-gray-900">{result.dailyMg} مجم</p>
                <p className="text-gray-500">الحد الأقصى اليومي</p>
              </div>
            </div>
            {result.cappedByMax && (
              <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                تم تقييد الجرعة بالحد الأقصى للبالغين حفاظاً على السلامة.
              </p>
            )}
            <p className="rounded-xl bg-gray-50 p-3 text-[11px] leading-6 text-gray-500">
              هذه الحاسبة إرشادية فقط ولا تُغني عن استشارة الطبيب أو الصيدلي، خصوصاً عند وجود
              أمراض مزمنة أو أدوية أخرى.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                to="/tools/schedule"
                className="press-scale rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white"
              >
                أضفها إلى جدول الأدوية
              </Link>
              <Link
                to="/ai-chat"
                className="press-scale rounded-xl border border-primary/25 bg-white/70 px-4 py-2 text-xs font-semibold text-primary"
              >
                اسأل الصيدلي الذكي
              </Link>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-2">
          <button
            onClick={() => (step === 0 ? undefined : setStep(step - 1))}
            disabled={step === 0}
            className="press-scale inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white/70 px-3 py-2 text-xs font-semibold text-gray-600 disabled:opacity-40"
          >
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            السابق
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canNext}
              className="press-scale inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              التالي
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : (
            <button
              onClick={reset}
              className="press-scale inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              حساب جديد
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
