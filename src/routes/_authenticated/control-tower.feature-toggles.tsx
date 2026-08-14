import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Bot, CarFront, Construction, Loader2, Pill, Stethoscope } from 'lucide-react'
import { toast } from 'sonner'
import { ControlTowerShell, GlassCard } from '@/components/admin/ControlTowerShell'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { asBoolean, type FeatureFlagKey } from '@/lib/control-tower/settings'

export const Route = createFileRoute('/_authenticated/control-tower/feature-toggles')({
  head: () => ({
    meta: [
      { title: 'تحكم الميزات المركزية — صيدلية المصلي' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: FeatureTogglesPage,
})

const TOGGLES: {
  key: FeatureFlagKey
  label: string
  icon: typeof Pill
  description: string
  danger?: boolean
}[] = [
  {
    key: 'enable_medication_vault',
    label: '💊 خزينة الأدوية والروشتات',
    icon: Pill,
    description: 'تشغيل خزينة الأدوية المزمنة ورفع الروشتات وصور العلب للمرضى.',
  },
  {
    key: 'enable_delivery_orders',
    label: '🚚 خدمة التوصيل المنزلي',
    icon: CarFront,
    description: 'السماح للعملاء باختيار التوصيل المنزلي عند إتمام الطلب.',
  },
  {
    key: 'enable_clinical_inspector',
    label: '🩺 لوحة الفحص السريري',
    icon: Stethoscope,
    description: 'وصول الصيادلة إلى مراجعة الأدوية المزمنة للمرضى.',
  },
  {
    key: 'enable_ai_marketing',
    label: '🤖 التسويق بالذكاء الاصطناعي',
    icon: Bot,
    description: 'وحدات المحتوى والحملات التسويقية المدعومة بالذكاء الاصطناعي.',
  },
  {
    key: 'maintenance_mode',
    label: '🛠️ وضع الصيانة',
    icon: Construction,
    description: 'إظهار إشعار الصيانة للعملاء. المديرون يحتفظون بالوصول الكامل.',
    danger: true,
  },
]

function FeatureTogglesPage() {
  const { settings, isLoading, updateSetting } = useSystemSettings()
  const [pending, setPending] = useState<string | null>(null)

  const handleToggle = async (key: FeatureFlagKey, next: boolean) => {
    setPending(key)
    try {
      await updateSetting.mutateAsync({ key, value: next })
      toast.success('تم تحديث إعداد الميزة')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر تحديث الإعداد')
    } finally {
      setPending(null)
    }
  }

  return (
    <ControlTowerShell
      title="تحكم الميزات المركزية"
      subtitle="كل تبديل يؤثر فورًا على سلوك النظام ويُسجَّل في سجل التدقيق."
    >
      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
        </div>
      ) : (
        <div className="grid gap-4">
          {TOGGLES.map((t) => {
            const enabled = asBoolean(settings?.[t.key], false)
            const busy = pending === t.key
            return (
              <GlassCard key={t.key}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={`rounded-xl p-2.5 ${
                        t.danger ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'
                      }`}
                    >
                      <t.icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-white">{t.label}</p>
                      <p className="mt-1 text-sm text-slate-400">{t.description}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={t.label}
                    disabled={busy}
                    onClick={() => handleToggle(t.key, !enabled)}
                    className={`relative h-7 w-14 shrink-0 rounded-full transition disabled:opacity-50 ${
                      enabled ? 'bg-emerald-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                        enabled ? 'right-1' : 'right-8'
                      }`}
                    />
                  </button>
                </div>
              </GlassCard>
            )
          })}
        </div>
      )}
    </ControlTowerShell>
  )
}
