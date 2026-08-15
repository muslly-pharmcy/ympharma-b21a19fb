/**
 * WhatsApp Cloud API sender (server-only).
 *
 * Equivalent of the requested `send-whatsapp-notification` function, implemented
 * as an internal server module instead of a Supabase Edge Function (this stack
 * runs its backend inside the app itself).
 *
 * Credentials are read from server secrets at call time — never at module scope,
 * never shipped to the browser.
 */
import { normalizePhone } from '@/lib/auth/phone'

const GRAPH_VERSION = 'v20.0'
const TIMEOUT_MS = 12_000

export interface WhatsAppSendResult {
  ok: boolean
  messageId?: string
  to?: string
  error?: string
  code?: string
}

function config(): { token: string; phoneNumberId: string } | null {
  const token = process.env['WHATSAPP_ACCESS_TOKEN'] ?? ''
  const phoneNumberId = process.env['WHATSAPP_PHONE_NUMBER_ID'] ?? ''
  if (!token || !phoneNumberId) return null
  return { token, phoneNumberId }
}

/** WhatsApp expects digits only, no leading `+`. */
export function toWhatsAppNumber(raw: string): string | null {
  const e164 = normalizePhone(raw)
  return e164 ? e164.replace(/^\+/, '') : null
}

function classify(status: number, body: unknown): { error: string; code: string } {
  const err = (body as { error?: { message?: string; code?: number; error_subcode?: number } })?.error
  const code = String(err?.code ?? status)
  const raw = err?.message ?? `HTTP ${status}`
  if (status === 401 || err?.code === 190) {
    return { error: 'رمز الوصول لواتساب غير صالح أو منتهي الصلاحية — يلزم تحديثه.', code }
  }
  if (err?.code === 131030) {
    return { error: 'الرقم غير مضاف لقائمة الأرقام المسموح بها في حساب واتساب التجريبي.', code }
  }
  if (err?.code === 131047 || err?.code === 131026) {
    return {
      error:
        'لا يمكن إرسال رسالة نصية حرة لهذا الرقم (خارج نافذة 24 ساعة أو الرقم غير مسجّل في واتساب) — يلزم استخدام قالب معتمد.',
      code,
    }
  }
  if (status === 429 || err?.code === 130429) {
    return { error: 'تم تجاوز حد الإرسال المسموح به مؤقتاً — أعد المحاولة لاحقاً.', code }
  }
  return { error: raw, code }
}

async function post(body: Record<string, unknown>): Promise<WhatsAppSendResult> {
  const cfg = config()
  if (!cfg) {
    return { ok: false, error: 'إعدادات واتساب غير مكتملة على الخادم.', code: 'not_configured' }
  }
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${cfg.phoneNumberId}/messages`

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      const json: unknown = await res.json().catch(() => ({}))
      if (res.ok) {
        const id = (json as { messages?: Array<{ id?: string }> })?.messages?.[0]?.id
        return { ok: true, messageId: id, to: String(body['to'] ?? '') }
      }
      const classified = classify(res.status, json)
      // Retry once on transient upstream/rate errors only.
      if (attempt === 0 && (res.status >= 500 || res.status === 429)) continue
      console.error('[whatsapp:send] failed', { status: res.status, code: classified.code })
      return { ok: false, ...classified }
    } catch (e) {
      const aborted = e instanceof Error && e.name === 'AbortError'
      if (attempt === 0) continue
      console.error('[whatsapp:send] network error', { aborted })
      return {
        ok: false,
        error: aborted ? 'انتهت مهلة الاتصال بخدمة واتساب.' : 'تعذر الاتصال بخدمة واتساب.',
        code: aborted ? 'timeout' : 'network',
      }
    } finally {
      clearTimeout(timer)
    }
  }
  return { ok: false, error: 'تعذر إرسال الرسالة.', code: 'unknown' }
}

/** Send a free-form text message (valid inside the 24h customer service window). */
export async function sendWhatsAppText(rawPhone: string, text: string): Promise<WhatsAppSendResult> {
  const to = toWhatsAppNumber(rawPhone)
  if (!to) return { ok: false, error: 'رقم الهاتف غير صالح.', code: 'invalid_phone' }
  return post({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: text.slice(0, 4000) },
  })
}

/** Send an approved template message (works outside the 24h window). */
export async function sendWhatsAppTemplate(
  rawPhone: string,
  templateName: string,
  languageCode = 'ar',
  bodyParams: string[] = [],
): Promise<WhatsAppSendResult> {
  const to = toWhatsAppNumber(rawPhone)
  if (!to) return { ok: false, error: 'رقم الهاتف غير صالح.', code: 'invalid_phone' }
  return post({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(bodyParams.length > 0
        ? {
            components: [
              {
                type: 'body',
                parameters: bodyParams.map((t) => ({ type: 'text', text: t })),
              },
            ],
          }
        : {}),
    },
  })
}

// ---------------- order notification ----------------

export interface OrderNotificationInput {
  orderId: string
  total: number
  address: string
  status: string
  customerName?: string | null
  currency?: string
  paymentMethod?: string | null
}

const STATUS_AR: Record<string, string> = {
  pending: 'قيد المراجعة',
  confirmed: 'مؤكد',
  processing: 'قيد التجهيز',
  shipped: 'قيد التوصيل',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
}

export function buildOrderNotificationText(input: OrderNotificationInput): string {
  const currency = input.currency ?? 'ر.ي'
  const shortRef = input.orderId.slice(0, 8).toUpperCase()
  const lines = [
    '🩺 *صيدلية المصلي*',
    input.customerName ? `أهلاً ${input.customerName}،` : 'أهلاً بك،',
    'تم استلام طلبك بنجاح ✅',
    '',
    `رقم الطلب: ${shortRef}`,
    `الإجمالي: ${Math.round(input.total).toLocaleString('ar-EG')} ${currency}`,
    `عنوان التوصيل: ${input.address}`,
    `حالة الطلب: ${STATUS_AR[input.status] ?? input.status}`,
  ]
  if (input.paymentMethod) lines.push(`طريقة الدفع: ${input.paymentMethod}`)
  lines.push('', 'سنوافيك بأي تحديث فور تجهيز الطلب. شكراً لثقتك بنا 💚')
  return lines.join('\n')
}

/** True when the Control Tower master switch for customer WhatsApp is on. */
export async function whatsappNotificationsEnabled(): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'customer_whatsapp_enabled')
      .maybeSingle()
    return (data as { value?: unknown } | null)?.value === true
  } catch {
    return false
  }
}

/**
 * Best-effort order notification. Never throws — a WhatsApp outage must never
 * fail a checkout.
 */
export async function notifyOrderPlaced(
  phone: string,
  input: OrderNotificationInput,
): Promise<WhatsAppSendResult> {
  try {
    if (!(await whatsappNotificationsEnabled())) {
      return { ok: false, error: 'إشعارات واتساب معطّلة من الإدارة المركزية.', code: 'disabled' }
    }
    return await sendWhatsAppText(phone, buildOrderNotificationText(input))
  } catch (e) {
    console.error('[whatsapp:notifyOrderPlaced]', e instanceof Error ? e.message : e)
    return { ok: false, error: 'تعذر إرسال إشعار واتساب.', code: 'unknown' }
  }
}
