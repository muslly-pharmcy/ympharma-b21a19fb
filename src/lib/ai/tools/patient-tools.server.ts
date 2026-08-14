// Patient-scope AI tools.
//
// Authorization rule: the MODEL never chooses its own permissions. This registry
// only contains tools that are safe for an anonymous/public caller. Anything that
// touches a specific person's data requires a verified user id passed in by the
// route — not by the model.
//
// Every tool: strict JSON schema in, validated JSON out, errors swallowed into a
// safe shape, no raw SQL, no arbitrary table access.

import { z } from 'zod'
import type { AiToolDef } from '../provider.server'

export interface ToolContext {
  /** Verified from the bearer token by the route. Null for anonymous visitors. */
  userId: string | null
  correlationId: string
}

export interface ToolExecution {
  name: string
  ok: boolean
  result: unknown
}

const PHARMACY_PHONE = '+967 782 878 280'

/* ---------------------------------- schemas --------------------------------- */

const searchMedicinesArgs = z.object({
  query: z.string(),
  limit: z.number().int().nullable(),
})

const deliveryArgs = z.object({
  area: z.string().nullable(),
})

const orderStatusArgs = z.object({
  order_code: z.string(),
})

/* ----------------------------------- defs ----------------------------------- */

export const PATIENT_TOOLS: AiToolDef[] = [
  {
    name: 'search_medicines',
    description:
      'ابحث في مخزون صيدلية المصلي عن دواء بالاسم التجاري أو العلمي (عربي/إنجليزي) وأعد التوفر والسعر. استخدمها لأي سؤال عن دواء أو سعر أو بديل. إذا لم تظهر نتائج بالاسم العربي، أعد الاستدعاء بالاسم الإنجليزي أو بالمادة الفعالة (مثال: بنادول ← Panadol ← Paracetamol) قبل أن تقول إنه غير متوفر.',

    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: { type: 'string', description: 'اسم الدواء أو المادة الفعالة' },
        limit: { type: ['integer', 'null'], description: 'عدد النتائج (1-8)' },
      },
      required: ['query', 'limit'],
    },
  },
  {
    name: 'delivery_info',
    description: 'أعد معلومات التوصيل ورسومه لمنطقة داخل عدن.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        area: { type: ['string', 'null'], description: 'اسم المديرية أو المنطقة' },
      },
      required: ['area'],
    },
  },
  {
    name: 'pharmacy_info',
    description: 'أعد بيانات الصيدلية: العنوان، ساعات العمل، أرقام التواصل، طرق الطلب.',
    parameters: { type: 'object', additionalProperties: false, properties: {}, required: [] },
  },
  {
    name: 'order_status',
    description:
      'أعد حالة طلب يخص المستخدم المسجّل الحالي فقط باستخدام رقم الطلب. لا تعمل للزوار غير المسجلين.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { order_code: { type: 'string' } },
      required: ['order_code'],
    },
  },
]

/* --------------------------------- execution -------------------------------- */

function esc(term: string): string {
  return term.replace(/[%_,()]/g, ' ').trim().slice(0, 60)
}

async function searchMedicines(raw: unknown): Promise<unknown> {
  const parsed = searchMedicinesArgs.safeParse(raw)
  if (!parsed.success) return { error: 'invalid_arguments' }
  const term = esc(parsed.data.query)
  if (term.length < 2) return { items: [], note: 'الاستعلام قصير جداً' }
  const limit = Math.min(Math.max(parsed.data.limit ?? 5, 1), 8)

  try {
    const { getPublicSupabase } = await import('@/lib/supabase-public.server')
    const supabase = getPublicSupabase()
    const like = `%${term}%`
    const { data, error } = await supabase
      .from('catalog_products')
      .select(
        'store_code, name_ar, name_en, generic_name, brand, sbdma_official_price, dosage_form, strength, requires_prescription',
      )
      .eq('is_public', true)
      .eq('status', 'approved')
      // active_ingredients is jsonb — ilike is invalid on it, so it is not searched here.
      .or(
        `name_ar.ilike.${like},name_en.ilike.${like},generic_name.ilike.${like},brand.ilike.${like}`,
      )
      .limit(limit)
    if (error) return { items: [], note: 'تعذر الوصول للمخزون الآن' }
    const rows = (data ?? []) as Array<Record<string, unknown>>
    return {
      items: rows.map((r) => ({
        code: r['store_code'],
        name: r['name_ar'] || r['name_en'],
        generic: r['generic_name'],
        brand: r['brand'],
        form: r['dosage_form'],
        strength: r['strength'],
        price_yer: r['sbdma_official_price'],
        requires_prescription: r['requires_prescription'],
      })),
      source: 'catalog',
    }

  } catch {
    return { items: [], note: 'تعذر الوصول للمخزون الآن' }
  }
}

async function deliveryInfo(raw: unknown): Promise<unknown> {
  const parsed = deliveryArgs.safeParse(raw)
  const area = parsed.success ? (parsed.data.area ?? '') : ''
  try {
    const { getPublicSupabase } = await import('@/lib/supabase-public.server')
    const supabase = getPublicSupabase()
    const { data } = await supabase.from('app_settings').select('key, value').in('key', [
      'delivery.fees',
      'delivery.enabled',
      'delivery.free_threshold',
    ])
    const settings = Object.fromEntries(
      ((data ?? []) as Array<{ key: string; value: unknown }>).map((r) => [r.key, r.value]),
    )
    return { area: area || null, settings, contact: PHARMACY_PHONE, source: 'app_settings' }
  } catch {
    return { area: area || null, note: 'راجع الصيدلية لتأكيد رسوم التوصيل', contact: PHARMACY_PHONE }
  }
}

function pharmacyInfo(): unknown {
  return {
    name: 'صيدلية المصلي · Almosly Pharmacy',
    city: 'عدن، اليمن',
    phone: PHARMACY_PHONE,
    whatsapp: PHARMACY_PHONE,
    ordering: ['الموقع الإلكتروني', 'واتساب', 'الحضور للفرع'],
    source: 'static',
  }
}

async function orderStatus(raw: unknown, ctx: ToolContext): Promise<unknown> {
  // Authorization enforced HERE, in application code — not by the prompt.
  if (!ctx.userId) return { error: 'unauthenticated', message: 'سجّل الدخول لعرض حالة طلبك' }
  const parsed = orderStatusArgs.safeParse(raw)
  if (!parsed.success) return { error: 'invalid_arguments' }
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('id, status, payment_status, total, created_at')
      .eq('id', parsed.data.order_code.slice(0, 40))
      .eq('user_id', ctx.userId) // scoped to the verified caller, always
      .maybeSingle()
    if (error || !data) return { found: false }
    const row = data as Record<string, unknown>
    return {
      found: true,
      order: {
        code: row['id'],
        status: row['status'],
        payment_status: row['payment_status'],
        total: row['total'],
        created_at: row['created_at'],
      },
      source: 'orders',
    }

  } catch {
    return { found: false }
  }
}

/** Execute one model-requested tool under application-enforced authorization. */
export async function executePatientTool(
  name: string,
  argsJson: string,
  ctx: ToolContext,
): Promise<ToolExecution> {
  let args: unknown = {}
  try {
    args = JSON.parse(argsJson || '{}')
  } catch {
    return { name, ok: false, result: { error: 'invalid_arguments' } }
  }

  try {
    switch (name) {
      case 'search_medicines':
        return { name, ok: true, result: await searchMedicines(args) }
      case 'delivery_info':
        return { name, ok: true, result: await deliveryInfo(args) }
      case 'pharmacy_info':
        return { name, ok: true, result: pharmacyInfo() }
      case 'order_status':
        return { name, ok: true, result: await orderStatus(args, ctx) }
      default:
        // Unknown / unauthorized tool name — the model does not get to invent tools.
        return { name, ok: false, result: { error: 'tool_not_available' } }
    }
  } catch {
    return { name, ok: false, result: { error: 'tool_failed' } }
  }
}
