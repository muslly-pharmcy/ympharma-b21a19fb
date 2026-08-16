/**
 * Pure, isomorphic builder for the WhatsApp order dispatch message.
 * No side effects, no imports — unit-testable and safe on client & server.
 */

export const PHARMACY_WHATSAPP_NUMBER = '967782878280'

export interface WhatsAppOrderLine {
  name: string
  quantity: number
  unitPrice: number
  imageUrl?: string | null
}

export interface WhatsAppOrderPayload {
  orderRef?: string | null
  customerName?: string | null
  phone?: string | null
  address?: string | null
  zoneName?: string | null
  paymentMethod?: string | null
  notes?: string | null
  lines: WhatsAppOrderLine[]
  shippingFee?: number
  currency?: string
}

function money(value: number, currency: string): string {
  return `${Math.round(value).toLocaleString('ar-EG')} ${currency}`
}

/** Build the Arabic-first, structured order text. */
export function buildOrderMessage(payload: WhatsAppOrderPayload): string {
  const currency = payload.currency ?? 'ر.ي'
  const subtotal = payload.lines.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  )
  const shipping = payload.shippingFee ?? 0
  const total = subtotal + shipping

  const parts: string[] = []
  parts.push('🛒 *طلب جديد — صيدلية المصلي*')
  if (payload.orderRef) parts.push(`رقم الطلب: ${payload.orderRef}`)
  parts.push('')
  parts.push('*الأصناف:*')

  payload.lines.forEach((line, index) => {
    parts.push(
      `${index + 1}) ${line.name}\n   الكمية: ${line.quantity} × ${money(
        line.unitPrice,
        currency,
      )} = ${money(line.unitPrice * line.quantity, currency)}`,
    )
    if (line.imageUrl) parts.push(`   📷 ${line.imageUrl}`)
  })

  parts.push('')
  parts.push(`المجموع الجزئي: ${money(subtotal, currency)}`)
  if (shipping > 0 || payload.zoneName) {
    parts.push(
      `الشحن${payload.zoneName ? ` (${payload.zoneName})` : ''}: ${money(shipping, currency)}`,
    )
  }
  parts.push(`*الإجمالي: ${money(total, currency)}*`)

  const details: string[] = []
  if (payload.customerName) details.push(`الاسم: ${payload.customerName}`)
  if (payload.phone) details.push(`الجوال: ${payload.phone}`)
  if (payload.address) details.push(`العنوان: ${payload.address}`)
  if (payload.paymentMethod) details.push(`طريقة الدفع: ${payload.paymentMethod}`)
  if (payload.notes) details.push(`ملاحظات: ${payload.notes}`)
  if (details.length > 0) {
    parts.push('')
    parts.push('*بيانات المستلم:*')
    parts.push(...details)
  }

  return parts.join('\n')
}

/** Full wa.me deep link with the encoded message. */
export function buildWhatsAppUrl(
  payload: WhatsAppOrderPayload,
  phoneNumber: string = PHARMACY_WHATSAPP_NUMBER,
): string {
  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(buildOrderMessage(payload))}`
}

/**
 * Opens WhatsApp in a new tab/native app. Returns the URL so the caller can
 * render a visible fallback link when the popup is blocked.
 */
export function openWhatsAppOrder(
  payload: WhatsAppOrderPayload,
  phoneNumber: string = PHARMACY_WHATSAPP_NUMBER,
): { url: string; opened: boolean } {
  const url = buildWhatsAppUrl(payload, phoneNumber)
  if (typeof window === 'undefined') return { url, opened: false }
  const win = window.open(url, '_blank', 'noopener,noreferrer')
  return { url, opened: Boolean(win) }
}
