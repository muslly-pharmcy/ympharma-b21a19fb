import { z } from 'zod'
import { requireOrganizationRecord } from '@/lib/organization-record.server'
import type { StockSetInput } from '@/lib/admin-stock'

type StockDatabase = Parameters<typeof requireOrganizationRecord>[0] & {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>
}

export async function setAdminStock(db: StockDatabase, actor: { organizationId: string; userId: string }, input: StockSetInput) {
  await requireOrganizationRecord(db, 'catalog_products', input.productId, actor.organizationId)
  const { data, error } = await db.rpc('inv_set_product_stock', {
    p_org: actor.organizationId, p_actor: actor.userId, p_product: input.productId,
    p_expected: input.expectedBalance, p_new: input.newBalance,
    p_key: input.idempotencyKey, p_reason: input.reason,
  })
  if (error) {
    const messages: Record<string, string> = {
      STOCK_BALANCE_CHANGED: 'تغيّر الرصيد؛ حدّث البيانات وأعد مراجعة التسوية',
      STOCK_RESERVED: 'لا يمكن تخفيض الرصيد إلى أقل من الكمية المحجوزة',
      RECEIVE_OR_SELECT_BATCH_REQUIRED: 'إضافة الرصيد تتطلب استلام دفعة موثقة أو اختيار دفعة محددة',
      STOCK_SET_FORBIDDEN: 'لا تملك صلاحية تسوية رصيد المؤسسة بالكامل',
      STOCK_WAREHOUSE_UNAVAILABLE: 'المخزن غير متاح للتسوية',
      IDEMPOTENCY_CONFLICT: 'تعارض في معرّف الطلب؛ أعد تحميل البيانات',
    }
    const code = Object.keys(messages).find((key) => error.message.includes(key))
    throw new Error(code ? messages[code] : 'تعذرت تسوية المخزون؛ تحقق من إعداد إجراء المخزون والصلاحيات')
  }
  return z.object({ ok: z.literal(true), delta: z.number().finite(), newBalance: z.number().finite() }).parse(data)
}
