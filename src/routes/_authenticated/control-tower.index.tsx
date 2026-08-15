import { createFileRoute, Link } from '@tanstack/react-router'
import { Activity, BrainCircuit, MessageCircle, ScrollText, Settings2, SlidersHorizontal, Truck } from 'lucide-react'
import { ControlTowerShell, GlassCard } from '@/components/admin/ControlTowerShell'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import {
  FEATURE_FLAG_KEYS,
  FEATURE_FLAG_LABELS_AR,
  PHARMACY_STATUS_AR,
  asBoolean,
  asPharmacyStatus,
} from '@/lib/control-tower/settings'

export const Route = createFileRoute('/_authenticated/control-tower/')({
  head: () => ({
    meta: [
      { title: 'الإدارة المركزية — صيدلية المصلي' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: ControlTowerDashboard,
})

const MODULES = [
  {
    to: '/control-tower/feature-toggles' as const,
    icon: SlidersHorizontal,
    title: 'تحكم الميزات',
    desc: 'تشغيل وإيقاف وحدات النظام مباشرة.',
  },
  {
    to: '/control-tower/delivery-config' as const,
    icon: Truck,
    title: 'إدارة التوصيل',
    desc: 'أسعار التوصيل لمناطق عدن.',
  },
  {
    to: '/control-tower/settings' as const,
    icon: Settings2,
    title: 'إعدادات النظام',
    desc: 'حالة الصيدلية والإعلان العاجل.',
  },
  {
    to: '/control-tower/ai-health' as const,
    icon: BrainCircuit,
    title: 'صحة الذكاء الاصطناعي',
    desc: 'أداء وأعطال كل نداءات الذكاء (قراءة فقط).',
  },
  {
    to: '/control-tower/whatsapp' as const,
    icon: MessageCircle,
    title: 'إشعارات واتساب',
    desc: 'ربط واتساب وإشعار العملاء تلقائياً عند الطلب.',
  },

  {
    to: '/control-tower/audit' as const,
    icon: ScrollText,
    title: 'سجل التدقيق',
    desc: 'كل تغيير إداري مسجّل ولا يمكن تعديله.',
  },
]

function ControlTowerDashboard() {
  const { settings, isLoading } = useSystemSettings()

  const activeFlags = FEATURE_FLAG_KEYS.filter(
    (k) => k !== 'maintenance_mode' && asBoolean(settings?.[k], false),
  ).length
  const maintenance = asBoolean(settings?.['maintenance_mode'], false)
  const status = asPharmacyStatus(settings?.['pharmacy_status'])

  return (
    <ControlTowerShell
      title="لوحة القيادة"
      subtitle="مركز التحكم الإداري لنظام YmPharma OS — إعدادات حية بصلاحيات محمية وسجل تدقيق كامل."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <GlassCard>
          <p className="text-xs text-slate-400">الميزات المفعّلة</p>
          <p className="mt-1 text-2xl font-bold text-emerald-400">
            {isLoading ? '—' : `${activeFlags}/4`}
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs text-slate-400">حالة الصيدلية</p>
          <p className="mt-1 text-2xl font-bold text-cyan-400">
            {isLoading ? '—' : PHARMACY_STATUS_AR[status]}
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs text-slate-400">وضع الصيانة</p>
          <p className={`mt-1 text-2xl font-bold ${maintenance ? 'text-amber-400' : 'text-slate-300'}`}>
            {isLoading ? '—' : maintenance ? 'مفعّل' : 'متوقف'}
          </p>
        </GlassCard>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {MODULES.map((m) => (
          <Link key={m.to} to={m.to} className="group">
            <GlassCard className="h-full transition group-hover:border-emerald-400/30 group-hover:bg-emerald-400/[0.06]">
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-emerald-500/15 p-2.5 text-emerald-400">
                  <m.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-white">{m.title}</p>
                  <p className="mt-1 text-sm text-slate-400">{m.desc}</p>
                </div>
              </div>
            </GlassCard>
          </Link>
        ))}
      </div>

      <GlassCard className="mt-6">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Activity className="h-4 w-4 text-cyan-400" />
          <span>حالة الميزات الحالية</span>
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {FEATURE_FLAG_KEYS.map((key) => (
            <li
              key={key}
              className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-sm"
            >
              <span className="text-slate-300">{FEATURE_FLAG_LABELS_AR[key]}</span>
              <span
                className={
                  asBoolean(settings?.[key], false)
                    ? 'text-emerald-400'
                    : 'text-slate-500'
                }
              >
                {isLoading ? '—' : asBoolean(settings?.[key], false) ? 'مفعّل' : 'متوقف'}
              </span>
            </li>
          ))}
        </ul>
      </GlassCard>
    </ControlTowerShell>
  )
}
