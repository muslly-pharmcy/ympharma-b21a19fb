import { z } from 'zod'

/** Control Tower setting keys (stored in public.app_settings). Keys stay English. */
export const FEATURE_FLAG_KEYS = [
  'enable_medication_vault',
  'enable_ai_marketing',
  'enable_delivery_orders',
  'enable_clinical_inspector',
  'enable_phone_auth',
  'maintenance_mode',
] as const

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number]

export const CONTROL_TOWER_KEYS = [
  ...FEATURE_FLAG_KEYS,
  'pharmacy_status',
  'custom_announcement',
  'delivery_fees_matrix',
] as const

export type ControlTowerKey = (typeof CONTROL_TOWER_KEYS)[number]

/** Aden delivery zones — database keys are English, labels are Arabic. */
export const DELIVERY_ZONES = [
  { key: 'crater', label: 'كريتر' },
  { key: 'mualla', label: 'المعلا' },
  { key: 'khormaksar', label: 'خور مكسر' },
  { key: 'mansoura', label: 'المنصورة' },
  { key: 'sheikh_othman', label: 'الشيخ عثمان' },
  { key: 'dar_saad', label: 'دار سعد' },
  { key: 'buraiqeh', label: 'البريقة' },
] as const

export type DeliveryZoneKey = (typeof DELIVERY_ZONES)[number]['key']

export const PHARMACY_STATUSES = ['OPEN', 'CLOSED', 'BUSY'] as const
export type PharmacyStatus = (typeof PHARMACY_STATUSES)[number]

export const PHARMACY_STATUS_AR: Record<PharmacyStatus, string> = {
  OPEN: 'مفتوحة',
  CLOSED: 'مغلقة',
  BUSY: 'ضغط عمل',
}

export const FEATURE_FLAG_LABELS_AR: Record<FeatureFlagKey, string> = {
  enable_medication_vault: 'خزينة الأدوية والروشتات',
  enable_delivery_orders: 'خدمة التوصيل المنزلي',
  enable_clinical_inspector: 'لوحة الفحص السريري',
  enable_ai_marketing: 'التسويق بالذكاء الاصطناعي',
  maintenance_mode: 'وضع الصيانة',
}

/**
 * Delivery fees are financial values: integer, finite, non-negative.
 * Rejects negative, decimal, NaN, Infinity and non-numbers.
 */
export const deliveryFeeSchema = z
  .number({ message: 'القيمة يجب أن تكون رقمًا' })
  .refine((n) => Number.isFinite(n), { message: 'القيمة يجب أن تكون رقمًا صحيحًا محدودًا' })
  .refine((n) => Number.isInteger(n), { message: 'لا تُقبل الكسور العشرية' })
  .refine((n) => n >= 0, { message: 'لا تُقبل القيم السالبة' })
  .refine((n) => n <= 1_000_000, { message: 'القيمة كبيرة بشكل غير منطقي' })

export const deliveryFeesMatrixSchema = z.record(z.string(), deliveryFeeSchema)

export type DeliveryFeesMatrix = Record<string, number>

export const announcementSchema = z.object({
  active: z.boolean(),
  text_ar: z.string().max(500, { message: 'النص طويل جدًا (500 حرف كحد أقصى)' }),
  type: z.enum(['info', 'warning', 'success']),
})

export type Announcement = z.infer<typeof announcementSchema>

export const pharmacyStatusSchema = z.enum(PHARMACY_STATUSES)

/** Parse an unknown jsonb value into a boolean flag with a safe default. */
export function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

export function asDeliveryMatrix(value: unknown): DeliveryFeesMatrix {
  const parsed = deliveryFeesMatrixSchema.safeParse(value)
  if (parsed.success) return parsed.data
  const out: DeliveryFeesMatrix = {}
  for (const zone of DELIVERY_ZONES) out[zone.key] = 0
  return out
}

export function asAnnouncement(value: unknown): Announcement {
  const parsed = announcementSchema.safeParse(value)
  return parsed.success ? parsed.data : { active: false, text_ar: '', type: 'info' }
}

export function asPharmacyStatus(value: unknown): PharmacyStatus {
  const parsed = pharmacyStatusSchema.safeParse(value)
  return parsed.success ? parsed.data : 'OPEN'
}
