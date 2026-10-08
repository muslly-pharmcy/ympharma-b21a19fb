import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import type { Database } from '@/integrations/supabase/types'

async function assertAdmin(supabase: SupabaseClient<Database>, userId: string): Promise<void> {
  const { data, error } = await supabase.rpc('has_role', {
    _user_id: userId,
    _role: 'admin',
  })
  if (error) throw new Error(error.message)
  if (!data) throw new Error('صلاحيات الأدمن مطلوبة')
}

export const isCurrentUserAdmin = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<boolean> => {
    const { data } = await context.supabase.rpc('has_role', {
      _user_id: context.userId,
      _role: 'admin',
    })
    return Boolean(data)
  })

export interface AdminOrderRow {
  id: string
  status: string
  payment_status: string
  total: number
  customer_name: string | null
  customer_phone: string | null
  customer_address: string | null
  payment_method_code: string | null
  created_at: string
  updated_at: string | null
}

export const listAllOrders = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z
      .object({
        status: z.string().min(1).max(40).optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }): Promise<AdminOrderRow[]> => {
    await assertAdmin(context.supabase, context.userId)
    let query = context.supabase
      .from('orders')
      .select(
        'id, status, payment_status, total, customer_name, customer_phone, customer_address, payment_method_code, created_at, updated_at',
      )
      .order('created_at', { ascending: false })
      .limit(data.limit ?? 200)
    if (data.status) query = query.eq('status', data.status)
    const { data: rows, error } = await query
    if (error) throw new Error(error.message)
    return (rows ?? []) as unknown as AdminOrderRow[]
  })

const VALID_STATUS = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const

export const updateOrderStatus = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z
      .object({
        orderId: z.string().min(4),
        status: z.enum(VALID_STATUS),
        note: z.string().max(500).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId)
    const { error: upErr } = await context.supabase
      .from('orders')
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq('id', data.orderId)
    if (upErr) throw new Error(upErr.message)
    const { error: histErr } = await context.supabase
      .from('order_status_history')
      .insert({
        order_id: data.orderId,
        status: data.status,
        changed_by: context.userId,
        note: data.note ?? `تحديث الحالة إلى ${data.status}`,
      } as never)
    if (histErr) throw new Error(histErr.message)

    // Best-effort WhatsApp notice to the customer; never blocks the status change.
    let notified = false
    try {
      const { data: ord } = await context.supabase
        .from('orders')
        .select('customer_name, customer_phone')
        .eq('id', data.orderId)
        .maybeSingle()
      const phone = (ord as { customer_phone?: string | null } | null)?.customer_phone
      const msgs: Record<string, string> = {
        confirmed: 'تم تأكيد طلبك وجاري تجهيزه.',
        shipped: 'طلبك خرج للتوصيل الآن.',
        delivered: 'تم تسليم طلبك. نتمنى لك دوام الصحة.',
        cancelled: 'تم إلغاء طلبك. للاستفسار تواصل معنا على 782878280.',
      }
      if (phone && msgs[data.status]) {
        const { sendWhatsAppText } = await import('./whatsapp/send.server')
        const name = (ord as { customer_name?: string | null }).customer_name ?? ''
        const r = await sendWhatsAppText(
          phone,
          `مرحباً ${name}، صيدلية المصلي: طلبك رقم ${data.orderId} — ${msgs[data.status]}`,
        )
        notified = r.ok
      }
    } catch (e) {
      console.warn('[updateOrderStatus] whatsapp notify skipped:', (e as Error).message)
    }
    return { ok: true, notified }
  })
