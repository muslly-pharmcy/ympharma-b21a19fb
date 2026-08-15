import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Loader2, MessageCircle, Send, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { ControlTowerShell, GlassCard } from '@/components/admin/ControlTowerShell'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { getWhatsAppStatus, sendWhatsAppNotification } from '@/lib/whatsapp/notify.functions'

export const Route = createFileRoute('/_authenticated/control-tower/whatsapp')({
  head: () => ({
    meta: [
      { title: 'إشعارات واتساب — الإدارة المركزية' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: WhatsAppPage,
})

interface SendState {
  ok: boolean
  messageId?: string
  error?: string
  code?: string
}

function WhatsAppPage() {
  const { settings, updateSetting } = useSystemSettings()
  const enabled = settings?.['customer_whatsapp_enabled'] === true

  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [template, setTemplate] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<SendState | null>(null)

  const status = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: () => getWhatsAppStatus(),
    staleTime: 300_000,
  })

  const handleToggle = async () => {
    try {
      await updateSetting.mutateAsync({ key: 'customer_whatsapp_enabled', value: !enabled })
      toast.success(!enabled ? 'تم تفعيل إشعارات واتساب' : 'تم إيقاف إشعارات واتساب')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر التحديث')
    }
  }

  const handleSend = async () => {
    if (phone.trim().length < 6) {
      toast.error('أدخل رقم هاتف صالح')
      return
    }
    setSending(true)
    setResult(null)
    try {
      const res = await sendWhatsAppNotification({
        data: {
          phone: phone.trim(),
          message: message.trim() || null,
          templateName: template.trim() || null,
        },
      })
      setResult(res)
      if (res.ok) toast.success('تم إرسال الرسالة')
      else toast.error(res.error ?? 'فشل الإرسال')
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'تعذر الإرسال'
      setResult({ ok: false, error: msg })
      toast.error(msg)
    } finally {
      setSending(false)
    }
  }

  return (
    <ControlTowerShell
      title="إشعارات واتساب"
      subtitle="ربط WhatsApp Business Cloud API لإشعار العملاء تلقائياً عند إنشاء الطلبات."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 font-semibold text-slate-100">
                <MessageCircle className="h-4 w-4 text-emerald-400" />
                إشعارات الطلبات التلقائية
              </p>
              <p className="mt-1 text-xs text-slate-400">
                عند إتمام أي طلب جديد تُرسل رسالة للعميل تتضمن رقم الطلب والإجمالي وعنوان التوصيل
                والحالة.
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggle}
              disabled={updateSetting.isPending}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${
                enabled
                  ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                  : 'bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/40'
              }`}
            >
              {enabled ? 'مفعّلة' : 'متوقفة'}
            </button>
          </div>

          <dl className="mt-4 space-y-2 text-xs text-slate-400">
            <div className="flex justify-between gap-2">
              <dt>حالة الإعداد على الخادم</dt>
              <dd className={status.data?.configured ? 'text-emerald-400' : 'text-red-400'}>
                {status.isLoading ? '…' : status.data?.configured ? 'مكتمل' : 'ناقص'}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Phone Number ID</dt>
              <dd className="font-mono">{status.data?.phoneNumberId || '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>WABA ID</dt>
              <dd className="font-mono">{status.data?.wabaId || '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>إصدار Graph API</dt>
              <dd className="font-mono">{status.data?.graphVersion ?? 'v20.0'}</dd>
            </div>
          </dl>
        </GlassCard>

        <GlassCard>
          <p className="font-semibold text-slate-100">اختبار الإرسال</p>
          <p className="mt-1 text-xs text-slate-400">
            الرسائل النصية الحرة تُقبل فقط خلال 24 ساعة من آخر رسالة يرسلها العميل — خارج ذلك استخدم
            اسم قالب معتمد.
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400" htmlFor="wa-phone">
                رقم الهاتف
              </label>
              <input
                id="wa-phone"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+967 7XX XXX XXX"
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/50"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400" htmlFor="wa-message">
                نص الرسالة (اختياري)
              </label>
              <textarea
                id="wa-message"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="رسالة اختبار من صيدلية المصلي ✅"
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/50"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400" htmlFor="wa-template">
                اسم قالب معتمد (اختياري — يتجاوز نافذة 24 ساعة)
              </label>
              <input
                id="wa-template"
                dir="ltr"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                placeholder="hello_world"
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/50"
              />
            </div>

            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              إرسال رسالة اختبار
            </button>
          </div>

          {result && (
            <div
              className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs ${
                result.ok
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                  : 'border-red-500/30 bg-red-500/10 text-red-200'
              }`}
            >
              {result.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <div>
                <p className="font-semibold">{result.ok ? 'تم الإرسال بنجاح' : 'فشل الإرسال'}</p>
                {result.messageId && (
                  <p className="mt-1 font-mono break-all opacity-80">{result.messageId}</p>
                )}
                {result.error && <p className="mt-1">{result.error}</p>}
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </ControlTowerShell>
  )
}
