// Public storefront request intake: prescription uploads, chronic refill
// subscriptions, health bundle orders, and lightweight AI/tools telemetry.
// All handlers are public by design (visitors have no account) — every write
// is validated, size-bounded, and never reads data back to the client.
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const phoneSchema = z
  .string()
  .trim()
  .min(6, 'رقم الهاتف غير صالح')
  .max(30)
  .regex(/^[0-9+\-\s()]+$/, 'رقم الهاتف غير صالح')

const nameSchema = z.string().trim().min(2, 'الاسم قصير جداً').max(120)

const MAX_FILE_BYTES = 6 * 1024 * 1024 // 6MB decoded

const prescriptionSchema = z.object({
  fullName: nameSchema,
  phone: phoneSchema,
  notes: z.string().trim().max(1000).optional(),
  fileName: z.string().trim().max(200).optional(),
  /** data:image/...;base64,xxx */
  fileData: z.string().max(9_000_000).optional(),
})

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; contentType: string } | null {
  const match = dataUrl.match(/^data:([\w/+.-]+);base64,(.+)$/)
  if (!match) return null
  const contentType = match[1] ?? 'application/octet-stream'
  if (!/^image\/(png|jpe?g|webp|heic|heif)$|^application\/pdf$/.test(contentType)) return null
  const binary = atob(match[2] ?? '')
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  if (bytes.byteLength > MAX_FILE_BYTES) return null
  return { bytes, contentType }
}

/** Submit a prescription photo + contact details. Returns a signed link for WhatsApp. */
export const submitPrescriptionUpload = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => prescriptionSchema.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    let filePath: string | null = null
    let signedUrl: string | null = null

    if (data.fileData) {
      const decoded = decodeDataUrl(data.fileData)
      if (!decoded) throw new Error('صيغة الملف غير مدعومة أو الحجم كبير (الحد 6 ميجابايت)')
      const ext = decoded.contentType === 'application/pdf' ? 'pdf' : decoded.contentType.split('/')[1] ?? 'jpg'
      const path = `uploads/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabaseAdmin.storage
        .from('prescriptions')
        .upload(path, decoded.bytes, { contentType: decoded.contentType, upsert: false })
      if (upErr) throw new Error('تعذّر رفع الصورة، حاول مرة أخرى')
      filePath = path
      const { data: signed } = await supabaseAdmin.storage
        .from('prescriptions')
        .createSignedUrl(path, 60 * 60 * 24 * 7)
      signedUrl = signed?.signedUrl ?? null
    }

    const { data: row, error } = await supabaseAdmin
      .from('store_prescription_uploads')
      .insert({
        full_name: data.fullName,
        phone: data.phone,
        notes: data.notes ?? null,
        file_path: filePath,
        file_name: data.fileName ?? null,
      })
      .select('id')
      .single()
    if (error) throw new Error('تعذّر حفظ الطلب، حاول مرة أخرى')

    const { syncCrmEvent } = await import('@/lib/integrations/google-sheets/sync.server')
    void syncCrmEvent({
      source: 'inquiry',
      category: 'وصفة طبية',
      fullName: data.fullName,
      phone: data.phone,
      details: `رفع وصفة طبية${data.notes ? ` — ${data.notes}` : ''}${signedUrl ? ` — ${signedUrl}` : ''}`,
    })

    return { id: row?.id as string, signedUrl }
  })

const refillSchema = z.object({
  fullName: nameSchema,
  phone: phoneSchema,
  productId: z.string().uuid().optional(),
  productName: z.string().trim().max(200).optional(),
  conditionTag: z.string().trim().max(60).optional(),
})

/** One-click monthly refill reminder subscription for chronic medication. */
export const subscribeRefillReminder = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => refillSchema.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { error } = await supabaseAdmin.from('store_refill_subscriptions').insert({
      full_name: data.fullName,
      phone: data.phone,
      product_id: data.productId ?? null,
      product_name: data.productName ?? null,
      condition_tag: data.conditionTag ?? null,
    })
    if (error) throw new Error('تعذّر تفعيل التذكير، حاول مرة أخرى')

    const { syncCrmEvent } = await import('@/lib/integrations/google-sheets/sync.server')
    void syncCrmEvent({
      source: 'inquiry',
      category: 'تذكير إعادة تعبئة',
      fullName: data.fullName,
      phone: data.phone,
      details: `اشتراك تذكير شهري — ${data.productName ?? 'دواء مزمن'}`,
    })
    return { ok: true }
  })

/** Public list of active health bundles with their items. */
export const listHealthBundles = createServerFn({ method: 'GET' }).handler(async () => {
  const { getPublicSupabase } = await import('./supabase-public.server')
  const supabase = getPublicSupabase()
  const { data: bundles, error } = await supabase
    .from('store_health_bundles')
    .select('id, slug, title_ar, description_ar, bundle_price, discount_label, image_url, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) return []
  const ids = (bundles ?? []).map((b) => b.id as string)
  if (!ids.length) return []
  const { data: items } = await supabase
    .from('store_health_bundle_items')
    .select('id, bundle_id, label_ar, quantity, product_id')
    .in('bundle_id', ids)
  return (bundles ?? []).map((b) => ({
    ...b,
    items: (items ?? []).filter((i) => i.bundle_id === b.id),
  }))
})

const bundleOrderSchema = z.object({
  bundleId: z.string().uuid(),
  bundleTitle: z.string().trim().max(200).optional(),
  fullName: nameSchema,
  phone: phoneSchema,
  notes: z.string().trim().max(500).optional(),
})

/** Order a curated health bundle. */
export const orderHealthBundle = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => bundleOrderSchema.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { error } = await supabaseAdmin.from('store_bundle_orders').insert({
      bundle_id: data.bundleId,
      bundle_title: data.bundleTitle ?? null,
      full_name: data.fullName,
      phone: data.phone,
      notes: data.notes ?? null,
    })
    if (error) throw new Error('تعذّر إرسال الطلب، حاول مرة أخرى')

    const { syncCrmEvent } = await import('@/lib/integrations/google-sheets/sync.server')
    void syncCrmEvent({
      source: 'order',
      category: 'باقة صحية',
      fullName: data.fullName,
      phone: data.phone,
      details: `طلب باقة: ${data.bundleTitle ?? data.bundleId}${data.notes ? ` — ${data.notes}` : ''}`,
    })
    return { ok: true }
  })

const widgetEventSchema = z.object({
  kind: z.enum(['assistant_open', 'assistant_message', 'tool_bmi', 'tool_pediatric', 'tool_interactions', 'rx_modal_open']),
  sessionId: z.string().trim().max(64).optional(),
  meta: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
})

/** Anonymous usage telemetry for the storefront assistant and calculators. */
export const logWidgetEvent = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => widgetEventSchema.parse(raw))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
      await supabaseAdmin.from('ai_widget_events').insert({
        kind: data.kind,
        session_id: data.sessionId ?? null,
        meta: (data.meta ?? {}) as never,
      })
    } catch {
      /* telemetry is best-effort */
    }
    return { ok: true }
  })
