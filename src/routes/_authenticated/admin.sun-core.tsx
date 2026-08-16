import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  getCrmSyncLog,
  getPlanetaryStatus,
  getSheetsSettings,
  previewDailyReport,
  sendDailyReportNow,
  updateSheetsSettings,
} from '@/lib/sun-core.functions'

export const Route = createFileRoute('/_authenticated/admin/sun-core')({
  head: () => ({
    meta: [
      { title: 'نواة الشمس — مركز التشغيل الذاتي | صيدلية المصلي' },
      { name: 'description', content: 'لوحة تشغيل نواة الشمس: حالة الوحدات، مزامنة Google Sheets، والتقرير التنفيذي اليومي.' },
      { property: 'og:title', content: 'نواة الشمس — مركز التشغيل الذاتي' },
      { property: 'og:description', content: 'مراقبة الوحدات، المزامنة، والتقارير التنفيذية اليومية.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: SunCoreAdmin,
  errorComponent: ({ error }) => (
    <div dir="rtl" className="p-8 text-center text-destructive">{(error as Error).message}</div>
  ),
})

const STATUS_STYLE: Record<string, string> = {
  healthy: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  degraded: 'bg-amber-50 text-amber-700 border-amber-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
  idle: 'bg-muted text-muted-foreground border-border',
}

const MODULE_LABEL: Record<string, string> = {
  inventory: 'المخزون',
  clinical: 'المحرك السريري',
  ocr: 'قراءة الفواتير',
  social: 'المحتوى الاجتماعي',
  crm: 'العملاء',
  analytics: 'التحليلات',
  tools: 'الأدوات',
  kernel: 'النواة',
}

function SunCoreAdmin() {
  const qc = useQueryClient()
  const statusFn = useServerFn(getPlanetaryStatus)
  const logFn = useServerFn(getCrmSyncLog)
  const previewFn = useServerFn(previewDailyReport)
  const settingsFn = useServerFn(getSheetsSettings)
  const saveFn = useServerFn(updateSheetsSettings)
  const sendFn = useServerFn(sendDailyReportNow)

  const status = useQuery({ queryKey: ['sun-core', 'status'], queryFn: () => statusFn({}) })
  const log = useQuery({ queryKey: ['sun-core', 'sync-log'], queryFn: () => logFn({}) })
  const preview = useQuery({ queryKey: ['sun-core', 'report'], queryFn: () => previewFn({}) })
  const settings = useQuery({ queryKey: ['sun-core', 'settings'], queryFn: () => settingsFn({}) })

  const [webhookUrl, setWebhookUrl] = useState<string | null>(null)
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          spreadsheetId: spreadsheetId ?? settings.data?.spreadsheetId ?? '',
          webhookUrl: webhookUrl ?? settings.data?.webhookUrl ?? '',
        },
      }),
    onSuccess: () => {
      toast.success('تم حفظ إعدادات المزامنة')
      void qc.invalidateQueries({ queryKey: ['sun-core', 'settings'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const send = useMutation({
    mutationFn: () => sendFn({}),
    onSuccess: (r) => {
      toast.success(r.emailQueued ? 'تم إرسال التقرير إلى بريدك' : 'تم إنشاء التقرير (تعذر وضعه في طابور البريد)')
      void qc.invalidateQueries({ queryKey: ['sun-core', 'report'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const r = preview.data?.report

  return (
    <div dir="rtl" className="mx-auto w-full max-w-6xl space-y-8 p-4 md:p-8">
      <header className="glass-panel rounded-3xl p-6">
        <h1 className="text-2xl font-bold text-foreground">نواة الشمس — مركز التشغيل الذاتي</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          حالة الوحدات، مزامنة العملاء مع Google Sheets، والتقرير التنفيذي اليومي (9:00 مساءً).
        </p>
      </header>

      {/* Planetary status */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">حالة الوحدات (24 ساعة)</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(status.data ?? []).map((m) => (
            <div key={m.moduleKey} className={`glass-card rounded-2xl border p-4 ${STATUS_STYLE[m.status] ?? ''}`}>
              <p className="text-sm font-semibold">{MODULE_LABEL[m.moduleKey] ?? m.moduleKey}</p>
              <p className="mt-1 text-xs opacity-80">
                تشغيلات {m.runs} · إخفاقات {m.failures} · زمن {m.avgLatencyMs}ms
              </p>
              <p className="mt-1 text-xs opacity-70">نسبة الأخطاء {(m.errorRate * 100).toFixed(1)}%</p>
            </div>
          ))}
          {status.isLoading && <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>}
        </div>
      </section>

      {/* Daily report */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">التقرير التنفيذي</h2>
          <div className="flex gap-2">
            {preview.data?.whatsappUrl && (
              <a
                href={preview.data.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-muted"
              >
                ملخص واتساب
              </a>
            )}
            <button
              onClick={() => send.mutate()}
              disabled={send.isPending}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {send.isPending ? 'جارٍ الإرسال…' : 'إرسال الآن'}
            </button>
          </div>
        </div>
        {r ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="الجلسات" value={r.visitors.sessions} />
            <Stat label="متوسط المكوث (د)" value={r.visitors.avgDwellMinutes} />
            <Stat label="الطلبات" value={r.sales.orders} />
            <Stat label="الإيراد" value={r.sales.revenue.toLocaleString('ar-YE')} />
            <Stat label="عملاء جدد" value={r.crm.newCustomers} />
            <Stat label="تمت مزامنتهم" value={r.crm.syncSynced} />
            <Stat label="تنبيهات المخزون" value={r.sales.safetyStockAlerts} />
            <Stat label="أخطاء 24 ساعة" value={r.health.errors} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">جارٍ تجميع التقرير…</p>
        )}
      </section>

      {/* Sheets settings */}
      <section className="glass-card space-y-3 rounded-2xl border border-border p-5">
        <h2 className="text-lg font-semibold">إعدادات مزامنة Google Sheets</h2>
        <label className="block text-sm">
          معرّف الجدول
          <input
            className="mt-1 w-full rounded-xl border border-border bg-background p-2 text-sm"
            value={spreadsheetId ?? settings.data?.spreadsheetId ?? ''}
            onChange={(e) => setSpreadsheetId(e.target.value)}
            placeholder="1UnYdgwEk6OZbui3gQ42rn_Tx2R6d68AOP9eITqAmMhQ"
          />
        </label>
        <label className="block text-sm">
          رابط Webhook بديل (اختياري)
          <input
            className="mt-1 w-full rounded-xl border border-border bg-background p-2 text-sm"
            value={webhookUrl ?? settings.data?.webhookUrl ?? ''}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://..."
          />
        </label>
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          حفظ
        </button>
      </section>

      {/* Sync log */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">سجل المزامنة</h2>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-right text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="p-2">الاسم</th>
                <th className="p-2">الهاتف</th>
                <th className="p-2">التصنيف</th>
                <th className="p-2">الحالة</th>
                <th className="p-2">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {(log.data ?? []).map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="p-2">{row.full_name ?? '—'}</td>
                  <td className="p-2">{row.phone ?? '—'}</td>
                  <td className="p-2">{row.category}</td>
                  <td className="p-2">{row.status}</td>
                  <td className="p-2 text-xs text-muted-foreground">
                    {new Date(row.created_at as string).toLocaleString('ar-YE')}
                  </td>
                </tr>
              ))}
              {!log.isLoading && (log.data ?? []).length === 0 && (
                <tr>
                  <td className="p-4 text-center text-muted-foreground" colSpan={5}>
                    لا توجد عمليات مزامنة بعد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass-card rounded-2xl border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
    </div>
  )
}
