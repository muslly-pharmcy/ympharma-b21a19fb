import { PHARMACY } from '@/shared/branding'

/**
 * Single source of truth for every structured WhatsApp payload the storefront
 * sends: normal cart orders, emergency fast-pass, special-order requests and
 * pharmacological-alternative requests.
 */

export interface WhatsAppLineItem {
  name: string
  quantity?: number
  price?: number | null
  dosage?: string | null
}

export interface WhatsAppOrderPayload {
  kind: 'order' | 'emergency' | 'special_order' | 'alternative' | 'stock_alert'
  customerName?: string | undefined
  phone?: string | undefined
  items: WhatsAppLineItem[]
  notes?: string | undefined
  /** Browser geolocation, when the customer allowed it. */
  location?: { lat: number; lng: number } | undefined
  address?: string | undefined
}

const HEAD: Record<WhatsAppOrderPayload['kind'], string> = {
  order: '🛒 *طلب جديد من المتجر*',
  emergency: '🚨 *طلب طوارئ — أولوية قصوى*',
  special_order: '📦 *طلب توفير خاص*',
  alternative: '🔄 *طلب بديل فارماكولوجي*',
  stock_alert: '🔔 *تنبيه عند توفر المنتج*',
}

export function formatMoney(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `${new Intl.NumberFormat('en-US').format(Math.round(value))} ر.ي`
}

/** Build the human-readable Arabic message body. */
export function buildWhatsAppMessage(payload: WhatsAppOrderPayload): string {
  const lines: string[] = [HEAD[payload.kind], `الصيدلية: ${PHARMACY.nameAr}`]

  if (payload.customerName) lines.push(`الاسم: ${payload.customerName}`)
  if (payload.phone) lines.push(`الهاتف: ${payload.phone}`)

  if (payload.items.length > 0) {
    lines.push('', '*الأصناف:*')
    let total = 0
    payload.items.forEach((item, i) => {
      const qty = item.quantity ?? 1
      const price = item.price ?? null
      if (price != null) total += price * qty
      const parts = [`${i + 1}. ${item.name}`, `الكمية: ${qty}`]
      if (price != null) parts.push(`السعر: ${formatMoney(price * qty)}`)
      if (item.dosage) parts.push(`الجرعة: ${item.dosage}`)
      lines.push(`• ${parts.join(' — ')}`)
    })
    if (total > 0) lines.push('', `*الإجمالي التقديري:* ${formatMoney(total)}`)
  }

  if (payload.address) lines.push('', `العنوان: ${payload.address}`)
  if (payload.location) {
    lines.push(
      `📍 الموقع: https://maps.google.com/?q=${payload.location.lat},${payload.location.lng}`,
    )
  }
  if (payload.notes) lines.push('', `ملاحظات: ${payload.notes}`)

  if (payload.kind === 'emergency') {
    lines.push('', '⏱️ الرجاء المعالجة كأولوية قصوى — الحالة عاجلة.')
  }

  lines.push('', 'حالة الطلب ستصلكم: قيد المراجعة ⏳ ← قيد التجهيز 💊 ← تم الإرسال 🚚')
  return lines.join('\n')
}

/** Full wa.me deep link ready for `window.open` / `<a href>`. */
export function buildWhatsAppUrl(payload: WhatsAppOrderPayload): string {
  return `${PHARMACY.whatsappUrl}?text=${encodeURIComponent(buildWhatsAppMessage(payload))}`
}

/** Ask the browser for coordinates; resolves to null when denied/unavailable. */
export function requestLocation(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null)
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    )
  })
}
