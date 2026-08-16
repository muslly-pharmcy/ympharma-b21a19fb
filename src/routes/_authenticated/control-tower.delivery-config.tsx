import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Loader2, Save, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { ControlTowerShell, GlassCard } from '@/components/admin/ControlTowerShell'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import {
  DELIVERY_ZONES,
  asDeliveryMatrix,
  deliveryFeeSchema,
  type DeliveryFeesMatrix,
} from '@/lib/control-tower/settings'

export const Route = createFileRoute('/_authenticated/control-tower/delivery-config')({
  head: () => ({
    meta: [
      { title: 'إدارة أسعار التوصيل — عدن' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: DeliveryConfigPage,
})

function DeliveryConfigPage() {
  const { settings, isLoading, updateSetting } = useSystemSettings()
  const stored = useMemo(
    () => asDeliveryMatrix(settings?.['delivery_fees_matrix']),
    [settings],
  )

  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft(
      Object.fromEntries(DELIVERY_ZONES.map((z) => [z.key, String(stored[z.key] ?? 0)])),
    )
  }, [stored])

  const errors = useMemo(() => {
    const out: Record<string, string> = {}
    for (const zone of DELIVERY_ZONES) {
      const raw = draft[zone.key] ?? ''
      if (raw.trim() === '') {
        out[zone.key] = 'القيمة مطلوبة'
        continue
      }
      const parsed = deliveryFeeSchema.safeParse(Number(raw))
      if (!parsed.success) out[zone.key] = parsed.error.issues[0]?.message ?? 'قيمة غير صالحة'
    }
    return out
  }, [draft])

  const isDirty = DELIVERY_ZONES.some(
    (z) => (draft[z.key] ?? '') !== String(stored[z.key] ?? 0),
  )
  const hasErrors = Object.keys(errors).length > 0

  const handleSave = async () => {
    if (hasErrors) {
      toast.error('صحّح القيم غير الصالحة قبل الحفظ')
      return
    }
    const next: DeliveryFeesMatrix = { ...stored }
    for (const zone of DELIVERY_ZONES) next[zone.key] = Number(draft[zone.key])
    setSaving(true)
    try {
      await updateSetting.mutateAsync({ key: 'delivery_fees_matrix', value: next })
      toast.success('تم حفظ أسعار التوصيل')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر حفظ الأسعار')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ControlTowerShell
      title="إدارة أسعار التوصيل — عدن"
      subtitle="القيم بالريال اليمني، أعداد صحيحة غير سالبة فقط."
    >
      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {DELIVERY_ZONES.map((zone) => (
              <GlassCard key={zone.key}>
                <label className="flex flex-col gap-2" htmlFor={`fee-${zone.key}`}>
                  <span className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Truck className="h-4 w-4 text-cyan-400" />
                    {zone.label}
                  </span>
                  <span className="text-xs text-slate-500">
                    السعر الحالي: {stored[zone.key] ?? 0} ريال
                  </span>
                  <input
                    id={`fee-${zone.key}`}
                    inputMode="numeric"
                    value={draft[zone.key] ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, [zone.key]: e.target.value }))}
                    className={`w-full rounded-xl border bg-slate-900/60 px-3 py-2 text-right text-slate-100 outline-none transition focus:border-emerald-400/60 ${
                      errors[zone.key] ? 'border-red-500/50' : 'border-white/10'
                    }`}
                  />
                  {errors[zone.key] && (
                    <span className="text-xs text-red-400">{errors[zone.key]}</span>
                  )}
                </label>
              </GlassCard>
            ))}
          </div>

          <div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/80 p-4 backdrop-blur-xl">
            <p className="text-sm text-slate-400">
              {isDirty ? 'لديك تغييرات غير محفوظة' : 'كل التغييرات محفوظة'}
            </p>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || hasErrors || saving}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              حفظ الأسعار
            </button>
          </div>
        </>
      )}
    </ControlTowerShell>
  )
}
