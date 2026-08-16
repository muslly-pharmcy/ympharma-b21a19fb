import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Droplets, Scale } from 'lucide-react'
import { useServerFn } from '@tanstack/react-start'
import { logWidgetEvent } from '@/lib/store-requests.functions'

export const Route = createFileRoute('/tools/bmi')({
  head: () => {
    const title = 'حاسبة كتلة الجسم والترطيب — صيدلية المصلي'
    const description =
      'احسب مؤشر كتلة الجسم (BMI) واحتياجك اليومي من الماء بدقة، مع تفسير عربي واضح من صيدلية المصلي في عدن.'
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary' },
      ],
      links: [{ rel: 'canonical', href: 'https://muslly.com/tools/bmi' }],
    }
  },
  component: BmiTool,
})

function classify(bmi: number): { label: string; tone: string; advice: string } {
  if (bmi < 18.5)
    return { label: 'نقص في الوزن', tone: 'text-amber-700 bg-amber-50', advice: 'زد السعرات الصحية وراجع الصيدلي حول المكمّلات الغذائية.' }
  if (bmi < 25)
    return { label: 'وزن طبيعي', tone: 'text-emerald-700 bg-emerald-50', advice: 'حافظ على نمطك الغذائي والنشاط البدني الحالي.' }
  if (bmi < 30)
    return { label: 'زيادة في الوزن', tone: 'text-orange-700 bg-orange-50', advice: 'نشاط بدني 150 دقيقة أسبوعياً وتقليل السكريات المضافة.' }
  return { label: 'سمنة', tone: 'text-red-700 bg-red-50', advice: 'يُنصح بمتابعة طبية لتقييم ضغط الدم والسكر والدهون.' }
}

function BmiTool() {
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [activity, setActivity] = useState<'low' | 'medium' | 'high'>('medium')
  const logEvent = useServerFn(logWidgetEvent)

  const result = useMemo(() => {
    const w = Number(weight)
    const hCm = Number(height)
    if (!w || !hCm || w <= 0 || hCm <= 0) return null
    const bmi = w / Math.pow(hCm / 100, 2)
    const base = w * 33 // ml/kg
    const factor = activity === 'low' ? 0.9 : activity === 'high' ? 1.2 : 1
    return {
      bmi: Math.round(bmi * 10) / 10,
      water: Math.round((base * factor) / 100) / 10, // litres
      ...classify(bmi),
    }
  }, [weight, height, activity])

  return (
    <div dir="rtl" className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-6 text-center">
        <span className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/60 px-3 py-1 text-[11px] font-semibold text-primary">
          أداة إرشادية · لا تغني عن استشارة الطبيب
        </span>
        <h1 className="text-2xl font-black text-foreground sm:text-3xl">حاسبة كتلة الجسم والترطيب</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-muted-foreground">
          أدخل وزنك وطولك لمعرفة مؤشر كتلة الجسم واحتياجك اليومي من الماء.
        </p>
      </header>

      <div className="glass-card space-y-4 rounded-3xl border border-white/40 p-5">
        <label className="block text-sm font-semibold text-foreground">
          الوزن (كجم)
          <input
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onBlur={() => void logEvent({ data: { kind: 'tool_bmi' } }).catch(() => {})}
            inputMode="decimal"
            placeholder="70"
            className="mt-1 w-full rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="block text-sm font-semibold text-foreground">
          الطول (سم)
          <input
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            inputMode="decimal"
            placeholder="170"
            className="mt-1 w-full rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm outline-none focus:border-primary"
          />
        </label>
        <div className="text-sm font-semibold text-foreground">
          مستوى النشاط
          <div className="mt-2 flex gap-2">
            {([
              ['low', 'خفيف'],
              ['medium', 'متوسط'],
              ['high', 'مرتفع'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActivity(key)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                  activity === key
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border bg-background/70 text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {result && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="glass-card rounded-3xl border border-white/40 p-5">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Scale className="h-4 w-4" /> مؤشر كتلة الجسم
            </p>
            <p className="mt-1 text-3xl font-black text-foreground">{result.bmi}</p>
            <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold ${result.tone}`}>
              {result.label}
            </span>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">{result.advice}</p>
          </div>
          <div className="glass-card rounded-3xl border border-white/40 p-5">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Droplets className="h-4 w-4" /> احتياجك اليومي من الماء
            </p>
            <p className="mt-1 text-3xl font-black text-foreground">{result.water} لتر</p>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              يزيد الاحتياج في الأجواء الحارة أو عند الحمى والإسهال.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
