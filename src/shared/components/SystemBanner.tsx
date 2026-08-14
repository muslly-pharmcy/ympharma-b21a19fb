import { AlertTriangle, Info, PartyPopper, Wrench } from 'lucide-react'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'

const TYPE_STYLES = {
  info: { className: 'bg-sky-50 text-sky-900 border-sky-200', Icon: Info },
  warning: { className: 'bg-amber-50 text-amber-900 border-amber-200', Icon: AlertTriangle },
  success: { className: 'bg-emerald-50 text-emerald-900 border-emerald-200', Icon: PartyPopper },
} as const

/** Renders maintenance mode + the admin announcement, driven by Control Tower settings. */
export function SystemBanner() {
  const { flags, announcement, isLoading } = useFeatureFlags()
  if (isLoading) return null

  return (
    <div dir="rtl" className="space-y-px">
      {flags.maintenance_mode && (
        <div className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900">
          <Wrench className="h-4 w-4 shrink-0" />
          <span>النظام في وضع الصيانة حاليًا — قد تكون بعض الخدمات غير متاحة مؤقتًا.</span>
        </div>
      )}
      {announcement.active && announcement.text_ar.trim() !== '' && (
        (() => {
          const { className, Icon } = TYPE_STYLES[announcement.type]
          return (
            <div
              role="status"
              className={`flex items-center justify-center gap-2 border-b px-4 py-2 text-sm ${className}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{announcement.text_ar}</span>
            </div>
          )
        })()
      )}
    </div>
  )
}
