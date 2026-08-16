import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Loader2, Megaphone, Save, Store } from 'lucide-react'
import { toast } from 'sonner'
import { ControlTowerShell, GlassCard } from '@/components/admin/ControlTowerShell'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import {
  PHARMACY_STATUSES,
  PHARMACY_STATUS_AR,
  announcementSchema,
  asAnnouncement,
  asPharmacyStatus,
  type PharmacyStatus,
} from '@/lib/control-tower/settings'

export const Route = createFileRoute('/_authenticated/control-tower/settings')({
  head: () => ({
    meta: [
      { title: 'إعدادات النظام — الإدارة المركزية' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: SystemSettingsPage,
})

const ANNOUNCEMENT_TYPES: { value: 'info' | 'warning' | 'success'; label: string }[] = [
  { value: 'info', label: 'معلومة' },
  { value: 'warning', label: 'تنبيه' },
  { value: 'success', label: 'خبر جيد' },
]

function SystemSettingsPage() {
  const { settings, isLoading, updateSetting } = useSystemSettings()
  const storedStatus = asPharmacyStatus(settings?.['pharmacy_status'])
  const storedAnnouncement = asAnnouncement(settings?.['custom_announcement'])

  const [announcement, setAnnouncement] = useState(storedAnnouncement)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setAnnouncement(storedAnnouncement)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedAnnouncement.active, storedAnnouncement.text_ar, storedAnnouncement.type])

  const handleStatus = async (status: PharmacyStatus) => {
    try {
      await updateSetting.mutateAsync({ key: 'pharmacy_status', value: status })
      toast.success('تم تحديث حالة الصيدلية')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر التحديث')
    }
  }

  const handleAnnouncement = async () => {
    const parsed = announcementSchema.safeParse(announcement)
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'بيانات غير صالحة')
      return
    }
    setSaving(true)
    try {
      await updateSetting.mutateAsync({ key: 'custom_announcement', value: parsed.data })
      toast.success('تم حفظ الإعلان')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر حفظ الإعلان')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ControlTowerShell
      title="إعدادات النظام"
      subtitle="حالة الصيدلية والإعلان الظاهر للعملاء — تُطبَّق فورًا على الواجهة."
    >
      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
        </div>
      ) : (
        <div className="grid gap-4">
          <GlassCard>
            <p className="flex items-center gap-2 font-semibold text-white">
              <Store className="h-5 w-5 text-emerald-400" /> حالة الصيدلية
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {PHARMACY_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => handleStatus(status)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    storedStatus === status
                      ? 'bg-emerald-500 text-slate-950'
                      : 'border border-white/10 bg-white/[0.03] text-slate-300 hover:border-emerald-400/40'
                  }`}
                >
                  {PHARMACY_STATUS_AR[status]}
                </button>
              ))}
            </div>
          </GlassCard>

          <GlassCard>
            <p className="flex items-center gap-2 font-semibold text-white">
              <Megaphone className="h-5 w-5 text-cyan-400" /> الإعلان العاجل
            </p>

            <label className="mt-4 flex items-center gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={announcement.active}
                onChange={(e) => setAnnouncement((a) => ({ ...a, active: e.target.checked }))}
                className="h-4 w-4 accent-emerald-500"
              />
              إظهار الإعلان للعملاء
            </label>

            <textarea
              value={announcement.text_ar}
              maxLength={500}
              rows={3}
              onChange={(e) => setAnnouncement((a) => ({ ...a, text_ar: e.target.value }))}
              placeholder="نص الإعلان بالعربية…"
              className="mt-3 w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-slate-100 outline-none focus:border-emerald-400/60"
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                {ANNOUNCEMENT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setAnnouncement((a) => ({ ...a, type: t.value }))}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      announcement.type === t.value
                        ? 'bg-cyan-500 text-slate-950'
                        : 'border border-white/10 text-slate-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleAnnouncement}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-40"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ الإعلان
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </ControlTowerShell>
  )
}
