import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarClock, Plus, Trash2, Bell, Sun, Moon, Sunrise } from 'lucide-react'
import { Reveal } from '@/shared/components/motion/Reveal'

export const Route = createFileRoute('/tools/schedule')({
  head: () => {
    const title = 'مخطط جدول الأدوية — صيدلية المصلي'
    const description =
      'نظّم مواعيد أدويتك اليومية بجدول تفاعلي يوزّع الجرعات على اليوم ويحفظها على جهازك.'
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary' },
      ],
      links: [{ rel: 'canonical', href: 'https://muslly.com/tools/schedule' }],
    }
  },
  component: SchedulePlanner,
})

type Med = {
  id: string
  name: string
  dose: string
  perDay: number
  startHour: number
  withFood: boolean
}

const STORAGE_KEY = 'ym_med_schedule_v1'

const SLOTS = [
  { key: 'morning', label: 'الصباح', range: [5, 11], icon: Sunrise },
  { key: 'noon', label: 'الظهيرة', range: [11, 17], icon: Sun },
  { key: 'evening', label: 'المساء', range: [17, 23], icon: Moon },
  { key: 'night', label: 'الليل', range: [23, 29], icon: Moon },
] as const

function timesFor(med: Med): number[] {
  const interval = Math.round(24 / Math.max(1, med.perDay))
  return Array.from({ length: med.perDay }, (_, i) => (med.startHour + i * interval) % 24)
}

function fmt(hour: number) {
  const h = ((hour + 11) % 12) + 1
  return `${h}:00 ${hour < 12 ? 'ص' : 'م'}`
}

function SchedulePlanner() {
  const [meds, setMeds] = useState<Med[]>([])
  const [loaded, setLoaded] = useState(false)
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [perDay, setPerDay] = useState(2)
  const [startHour, setStartHour] = useState(8)
  const [withFood, setWithFood] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) setMeds(JSON.parse(raw) as Med[])
    } catch {
      /* ignore corrupt storage */
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(meds))
    } catch {
      /* storage full or blocked */
    }
  }, [meds, loaded])

  const add = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setMeds((prev) => [
      ...prev,
      {
        id: `${Date.now()}`,
        name: trimmed,
        dose: dose.trim(),
        perDay,
        startHour,
        withFood,
      },
    ])
    setName('')
    setDose('')
  }

  const grouped = useMemo(() => {
    return SLOTS.map((slot) => {
      const entries: { med: Med; hour: number }[] = []
      for (const med of meds) {
        for (const hour of timesFor(med)) {
          const normalized = hour < 5 ? hour + 24 : hour
          if (normalized >= slot.range[0] && normalized < slot.range[1]) {
            entries.push({ med, hour })
          }
        }
      }
      entries.sort((a, b) => a.hour - b.hour)
      return { slot, entries }
    })
  }, [meds])

  return (
    <div dir="rtl" className="mx-auto max-w-3xl px-4 py-10">
      <Reveal className="mb-6 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <CalendarClock className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="text-fluid-title font-black text-gray-900">مخطط جدول الأدوية</h1>
        <p className="mt-2 text-sm text-gray-600">
          أضف أدويتك وسنوزّع الجرعات تلقائياً على مدار اليوم — محفوظة على جهازك فقط.
        </p>
      </Reveal>

      <div className="glass-card p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-gray-900">اسم الدواء</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: أوجمنتين"
              className="w-full rounded-xl border border-gray-200 bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-gray-900">الجرعة</span>
            <input
              value={dose}
              onChange={(e) => setDose(e.target.value)}
              placeholder="مثال: 5 مل / قرص واحد"
              className="w-full rounded-xl border border-gray-200 bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-gray-900">عدد المرات يومياً</span>
            <select
              value={perDay}
              onChange={(e) => setPerDay(Number(e.target.value))}
              className="w-full rounded-xl border border-gray-200 bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-primary"
            >
              {[1, 2, 3, 4, 6].map((n) => (
                <option key={n} value={n}>
                  {n} مرات
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-gray-900">أول جرعة</span>
            <select
              value={startHour}
              onChange={(e) => setStartHour(Number(e.target.value))}
              className="w-full rounded-xl border border-gray-200 bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-primary"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {fmt(h)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-gray-700">
          <input
            type="checkbox"
            checked={withFood}
            onChange={(e) => setWithFood(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 accent-[color:var(--color-primary,#0f766e)]"
          />
          يُؤخذ مع الطعام
        </label>

        <button
          onClick={add}
          disabled={!name.trim()}
          className="press-scale mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          <Plus className="h-4 w-4" aria-hidden />
          أضف إلى الجدول
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {grouped.map(({ slot, entries }) => {
          const Icon = slot.icon
          return (
            <div key={slot.key} className="glass-card p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
                <Icon className="h-4 w-4 text-primary" aria-hidden />
                {slot.label}
              </p>
              {entries.length === 0 ? (
                <p className="text-xs text-gray-400">لا توجد جرعات في هذه الفترة.</p>
              ) : (
                <ul className="space-y-2">
                  <AnimatePresence initial={false}>
                    {entries.map(({ med, hour }) => (
                      <motion.li
                        key={`${med.id}-${hour}`}
                        layout
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 12 }}
                        className="flex items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-gray-900">{med.name}</p>
                          <p className="truncate text-[11px] text-gray-500">
                            {fmt(hour)}
                            {med.dose ? ` · ${med.dose}` : ''}
                            {med.withFood ? ' · مع الطعام' : ''}
                          </p>
                        </div>
                        <Bell className="h-3.5 w-3.5 shrink-0 text-primary/60" aria-hidden />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          )
        })}
      </div>

      {meds.length > 0 && (
        <div className="glass-card mt-6 p-4">
          <p className="mb-3 text-sm font-bold text-gray-900">أدويتي ({meds.length})</p>
          <ul className="space-y-2">
            {meds.map((med) => (
              <li
                key={med.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2"
              >
                <span className="min-w-0 truncate text-xs text-gray-700">
                  {med.name} · {med.perDay} مرات يومياً
                </span>
                <button
                  onClick={() => setMeds((prev) => prev.filter((m) => m.id !== med.id))}
                  aria-label={`حذف ${med.name}`}
                  className="press-scale shrink-0 rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link
          to="/tools/interactions"
          className="press-scale rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white"
        >
          افحص التداخلات بين أدويتي
        </Link>
        <Link
          to="/tools"
          className="press-scale rounded-xl border border-primary/25 bg-white/70 px-4 py-2 text-xs font-semibold text-primary"
        >
          كل الأدوات
        </Link>
      </div>
    </div>
  )
}
