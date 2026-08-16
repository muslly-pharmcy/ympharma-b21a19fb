import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

// ---------- Public: shipping zones ----------
export interface ShippingZone {
  id: string
  code: string
  name_ar: string
  name_en: string | null
  regions: string[]
  fee: number
  currency: string
  estimated_days: string | null
  sort_order: number
}

export const listShippingZones = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ShippingZone[]> => {
    const { getPublicSupabase } = await import('./supabase-public.server')
    const supabase = getPublicSupabase()
    const { data, error } = await supabase
      .from('shipping_zones')
      .select('id, code, name_ar, name_en, regions, fee, currency, estimated_days, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
    if (error) {
      console.error('[listShippingZones]', error)
      return []
    }
    return (data ?? []) as unknown as ShippingZone[]
  },
)

// ---------- Public: payment methods ----------
export interface PaymentMethod {
  id: string
  code: string
  name_ar: string
  name_en: string | null
  description_ar: string | null
  instructions_ar: string | null
  requires_receipt: boolean
  sort_order: number
}

export const listPaymentMethods = createServerFn({ method: 'GET' }).handler(
  async (): Promise<PaymentMethod[]> => {
    const { getPublicSupabase } = await import('./supabase-public.server')
    const supabase = getPublicSupabase()
    const { data, error } = await supabase
      .from('payment_methods')
      .select('id, code, name_ar, name_en, description_ar, instructions_ar, requires_receipt, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
    if (error) {
      console.error('[listPaymentMethods]', error)
      return []
    }
    return (data ?? []) as unknown as PaymentMethod[]
  },
)

// ---------- Public: signed product image URLs ----------
// Uses the admin client server-side only to generate signed URLs for approved
// media on a public product. No privileged data is returned.
export const listProductImageUrls = createServerFn({ method: 'GET' })
  .validator((raw: unknown) =>
    z.object({ productId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data }): Promise<{ url: string; alt: string | null; kind: string }[]> => {
    const { getPublicSupabase } = await import('./supabase-public.server')
    const supabase = getPublicSupabase()
    // Confirm product is publicly listed.
    const { data: p } = await supabase
      .from('catalog_products')
      .select('id')
      .eq('id', data.productId)
      .eq('is_public', true)
      .eq('status', 'approved')
      .maybeSingle()
    if (!p) return []

    const { data: media } = await supabase
      .from('catalog_product_media')
      .select('storage_bucket, storage_path, kind, alt_text, sort_order, status')
      .eq('product_id', data.productId)
      .eq('status', 'approved')
      .order('sort_order', { ascending: true })

    const rows = (media ?? []) as Array<{
      storage_bucket: string
      storage_path: string
      kind: string
      alt_text: string | null
    }>
    if (rows.length === 0) return []

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const out: { url: string; alt: string | null; kind: string }[] = []
    for (const m of rows) {
      const bucket = m.storage_bucket || 'product-images'
      const { data: signed } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrl(m.storage_path, 60 * 60 * 24) // 24h
      if (signed?.signedUrl) {
        out.push({ url: signed.signedUrl, alt: m.alt_text, kind: m.kind })
      }
    }
    return out
  })

// ---------- Authenticated: place order ----------
const placeOrderInput = z.object({
  shippingZoneId: z.string().uuid(),
  paymentMethodCode: z.string().min(2).max(40),
  customerName: z.string().min(2).max(120),
  phone: z.string().min(6).max(30),
  address: z.string().min(4).max(500),
  notes: z.string().max(1000).optional().nullable(),
})

export interface PlacedOrder {
  id: string
  total: number
  requires_receipt: boolean
  payment_method_code: string
}

export const placeOrder = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => placeOrderInput.parse(raw))
  .handler(async ({ data, context }): Promise<PlacedOrder> => {
    // Delegates to the atomic FEFO checkout RPC (deducts stock,
    // records movements, creates order + history, clears cart).
    const { data: result, error } = await context.supabase.rpc(
      'checkout_cart_fefo',
      {
        p_customer_name: data.customerName,
        p_customer_phone: data.phone,
        p_customer_address: data.address,
        p_shipping_zone_id: data.shippingZoneId,
        p_payment_method_code: data.paymentMethodCode,
        p_notes: data.notes ?? null,
      } as never,
    )
    if (error) {
      const msg = error.message || ''
      if (msg.includes('CART_EMPTY')) throw new Error('السلة فارغة')
      if (msg.includes('INSUFFICIENT_STOCK')) {
        throw new Error(msg.replace(/^.*INSUFFICIENT_STOCK:\s*/, 'المخزون غير كافٍ للمنتج: '))
      }
      if (msg.includes('PRODUCT_NOT_SELLABLE')) {
        throw new Error(msg.replace(/^.*PRODUCT_NOT_SELLABLE:\s*/, 'المنتج غير متاح للبيع: '))
      }
      if (msg.includes('NO_ORG_MEMBERSHIP')) throw new Error('لا توجد منظمة نشطة مربوطة بحسابك')
      if (msg.includes('SHIPPING_ZONE_UNAVAILABLE')) throw new Error('منطقة الشحن غير متاحة')
      if (msg.includes('PAYMENT_METHOD_UNAVAILABLE')) throw new Error('طريقة الدفع غير متاحة')
      throw new Error(msg || 'فشل إتمام الطلب')
    }
    const r = result as {
      order_id: string
      total: number
      requires_receipt: boolean
      payment_method_code: string
    }
    // CRM bridge → Google Sheets (best effort, never blocks the order).
    try {
      const { syncCrmEvent } = await import('@/lib/integrations/google-sheets/sync.server')
      void syncCrmEvent({
        source: 'order',
        category: 'طلب',
        fullName: data.customerName,
        phone: data.phone,
        details: `طلب #${r.order_id} — الإجمالي ${Number(r.total)} — الدفع ${r.payment_method_code}`,
      })
    } catch {
      /* non-blocking */
    }

    // WhatsApp customer notification (best effort, never blocks the order).
    try {
      const { notifyOrderPlaced } = await import('@/lib/whatsapp/send.server')
      void notifyOrderPlaced(data.phone, {
        orderId: r.order_id,
        total: Number(r.total),
        address: data.address,
        status: 'pending',
        customerName: data.customerName,
        paymentMethod: r.payment_method_code,
      })
    } catch {
      /* non-blocking */
    }


    return {
      id: r.order_id,
      total: Number(r.total),
      requires_receipt: Boolean(r.requires_receipt),
      payment_method_code: r.payment_method_code,
    }
  })

// ---------- Authenticated: my orders ----------
export interface MyOrderRow {
  id: string
  status: string
  payment_status: string
  total: number
  subtotal: number | null
  shipping_fee: number | null
  payment_method_code: string | null
  payment_receipt_path: string | null
  customer_name: string | null
  phone: string | null
  address: string | null
  notes: string | null
  items: Array<{
    product_id: string
    name_ar: string
    brand: string | null
    strength: string | null
    quantity: number
    unit_price: number
    line_total: number
  }>
  created_at: string
  updated_at: string | null
}

export const listMyOrders = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyOrderRow[]> => {
    const { data, error } = await context.supabase
      .from('orders')
      .select(
        'id, status, payment_status, total, subtotal, shipping_fee, payment_method_code, payment_receipt_path, customer_name, phone:customer_phone, address:customer_address, notes, items, created_at, updated_at',
      )
      .eq('user_id', context.userId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw new Error(error.message)
    return (data ?? []) as unknown as MyOrderRow[]
  })

export const getMyOrder = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => z.object({ id: z.string().min(4) }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: order, error } = await context.supabase
      .from('orders')
      .select(
        'id, status, payment_status, total, subtotal, shipping_fee, payment_method_code, payment_receipt_path, customer_name, phone:customer_phone, address:customer_address, notes, items, created_at, updated_at, user_id',
      )
      .eq('id', data.id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    const row = order as unknown as (MyOrderRow & { user_id: string | null }) | null
    if (!row || row.user_id !== context.userId) return null

    const { data: history } = await context.supabase
      .from('order_status_history')
      .select('id, status, note, created_at')
      .eq('order_id', data.id)
      .order('created_at', { ascending: true })
    return { order: row as MyOrderRow, history: (history ?? []) as unknown as Array<{ id: string; status: string; note: string | null; created_at: string }> }
  })

// ---------- Authenticated: attach payment receipt path ----------
export const setOrderReceipt = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z.object({ orderId: z.string().min(4), receiptPath: z.string().min(4) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    // RLS on `orders` scopes update to staff, so verify ownership then use admin only for the write.
    const { data: order } = await context.supabase
      .from('orders')
      .select('id, user_id')
      .eq('id', data.orderId)
      .maybeSingle()
    if (!order || (order as { user_id: string }).user_id !== context.userId) {
      throw new Error('لا يمكن تعديل هذا الطلب')
    }
    // Receipt path must live inside the user's folder.
    if (!data.receiptPath.startsWith(`${context.userId}/`)) {
      throw new Error('مسار الإيصال غير صالح')
    }
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { error } = await supabaseAdmin
      .from('orders')
      .update({ payment_receipt_path: data.receiptPath, payment_status: 'submitted' })
      .eq('id', data.orderId)
    if (error) throw new Error(error.message)
    return { ok: true }
  })
