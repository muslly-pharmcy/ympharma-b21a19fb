// Vision-powered server functions: prescription OCR, invoice OCR,
// bulk media linking by barcode, and signed-URL minting for uploads.
// All require an authenticated user; admin operations further check role.
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

// ─── SIGNED UPLOAD URL ─────────────────────────────────────────────────────

const uploadBuckets = ['prescriptions', 'invoice-uploads', 'product-images'] as const
type UploadBucket = (typeof uploadBuckets)[number]

export const createVisionUploadUrl = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z
      .object({
        bucket: z.enum(uploadBuckets),
        filename: z.string().min(1).max(200),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${context.userId}/${Date.now()}-${safeName}`
    const { data: signed, error } = await supabaseAdmin.storage
      .from(data.bucket)
      .createSignedUploadUrl(path)
    if (error) throw new Error(error.message)
    return { path, token: signed.token, bucket: data.bucket as UploadBucket }
  })

async function signedReadUrl(bucket: string, path: string): Promise<string> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 5)
  if (error || !data) throw new Error(error?.message ?? 'signed url failed')
  return data.signedUrl
}

// ─── S2: PRESCRIPTION OCR ──────────────────────────────────────────────────

const prescriptionSchema = z.object({
  doctor_name: z.string().nullable(),
  prescription_date: z.string().nullable(),
  patient_name: z.string().nullable(),
  medications: z.array(
    z.object({
      name: z.string(),
      dose: z.string().nullable(),
      frequency: z.string().nullable(),
      duration: z.string().nullable(),
    }),
  ),
  notes: z.string().nullable(),
  confidence: z.number().min(0).max(1),
})

export const analyzePrescriptionImage = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z.object({ storagePath: z.string().min(4) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { callVision } = await import('./ai/vision.server')
    const imageUrl = await signedReadUrl('prescriptions', data.storagePath)

    const vision = await callVision({
      systemPrompt: `أنت صيدلي خبير في اليمن (عدن).
مهمتك: قراءة الروشتة المرفقة واستخراج بياناتها كـ JSON.
- إذا كان الخط غير واضح، ضع confidence منخفض ولا تخترع أسماء أدوية.
- اذكر اسم الدواء كما هو مكتوب (اسم تجاري أو علمي).
- الجرعة (dose) مثل: 500mg. التكرار (frequency) مثل: مرتين يومياً.
- إذا لم تجد حقلاً، أرجع null.`,
      userPrompt: 'استخرج بيانات الروشتة من الصورة.',
      imageUrl,
      schema: prescriptionSchema,
      maxOutputTokens: 1200,
    })

    if (!vision.data) {
      return {
        ok: false as const,
        error: 'تعذّر تحليل الصورة',
        rawText: vision.rawText.slice(0, 400),
        matches: [],
      }
    }

    // Match extracted medications against the catalog.
    const meds = vision.data.medications ?? []
    const matches: Array<{
      query: string
      products: Array<{ id: string; name_ar: string; brand: string | null; requires_prescription: boolean }>
    }> = []

    for (const med of meds.slice(0, 12)) {
      const term = med.name.trim()
      if (!term) continue
      const like = `%${term.replace(/[%_]/g, '')}%`
      const { data: rows } = await context.supabase
        .from('catalog_products')
        .select('id, name_ar, brand, requires_prescription')
        .or(`name_ar.ilike.${like},brand.ilike.${like},generic_name.ilike.${like}`)
        .eq('status', 'approved')
        .limit(3)
      matches.push({ query: term, products: (rows ?? []) as never })
    }

    // Audit trail — best-effort, non-blocking.


    return {
      ok: true as const,
      extraction: vision.data,
      matches,
      model: vision.model,
      usedFallback: vision.usedFallback,
    }
  })

// ─── S3: INVOICE OCR → catalog_import_jobs ────────────────────────────────

const invoiceSchema = z.object({
  supplier_name: z.string().nullable(),
  invoice_number: z.string().nullable(),
  invoice_date: z.string().nullable(),
  currency: z.string().nullable(),
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().nullable(),
      unit_cost: z.number().nullable(),
      selling_price: z.number().nullable(),
      batch_no: z.string().nullable(),
      expiry_date: z.string().nullable(),
      barcode: z.string().nullable(),
    }),
  ),
  confidence: z.number().min(0).max(1),
})

async function assertAdmin(supabase: unknown, userId: string): Promise<void> {
  const client = supabase as {
    rpc: (fn: 'has_role', args: { _user_id: string; _role: 'admin' }) => Promise<{
      data: boolean | null
      error: { message: string } | null
    }>
  }
  const { data } = await client.rpc('has_role', { _user_id: userId, _role: 'admin' })
  if (!data) throw new Error('صلاحيات الأدمن مطلوبة')
}

export const analyzeInvoiceImage = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z.object({ storagePath: z.string().min(4), sourceName: z.string().max(200).optional() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId)

    const { callVision } = await import('./ai/vision.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const imageUrl = await signedReadUrl('invoice-uploads', data.storagePath)

    const vision = await callVision({
      systemPrompt: `أنت محاسب صيدلاني في عدن.
مهمتك: قراءة فاتورة المورد المرفقة كـ صورة واستخراج جدول الأصناف كـ JSON.
- name: اسم الصنف بالعربية أو الإنجليزية كما هو مكتوب.
- quantity: عدد الوحدات (رقم، أو null).
- unit_cost: سعر التكلفة للوحدة (رقم، أو null).
- selling_price: سعر البيع للجمهور (رقم إن وُجد، أو null).
- expiry_date: بصيغة YYYY-MM-DD أو null.
- barcode: إن وُجد على الفاتورة.
- لا تخترع بيانات. إذا لم تظهر في الصورة، أرجع null.`,
      userPrompt: 'استخرج جدول أصناف الفاتورة.',
      imageUrl,
      schema: invoiceSchema,
      maxOutputTokens: 3000,
    })

    if (!vision.data || vision.data.items.length === 0) {
      return { ok: false as const, error: 'تعذّر استخراج أصناف من الصورة', rawText: vision.rawText.slice(0, 500) }
    }

    // Create a catalog_import_job in dry_run mode and populate rows with
    // decision-engine style classification (matched / new / ambiguous / invalid).
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('catalog_import_jobs')
      .insert({
        source_name: data.sourceName ?? `invoice-ocr:${vision.data.supplier_name ?? 'unknown'}`,
        uploaded_by: context.userId,
        dry_run: true,
        status: 'analyzing',
        total_rows: vision.data.items.length,
      } as never)
      .select('id')
      .single()
    if (jobErr || !job) throw new Error(jobErr?.message ?? 'failed to create import job')

    let matched = 0
    let created = 0
    let ambiguous = 0
    let invalid = 0
    const rowInserts: Array<Record<string, unknown>> = []

    for (let i = 0; i < vision.data.items.length; i++) {
      const item = vision.data.items[i]!
      const payload = {
        name_ar: item.name,
        barcode: item.barcode,
        sbdma_official_price: item.selling_price,
        _quantity: item.quantity,
        _unit_cost: item.unit_cost,
        _batch_no: item.batch_no,
        _expiry_date: item.expiry_date,
      }

      if (!item.name || item.name.trim().length < 2) {
        invalid++
        rowInserts.push({
          job_id: (job as { id: string }).id,
          row_index: i,
          payload,
          decision: 'invalid',
          reason: 'اسم الصنف مفقود',
        })
        continue
      }

      // Barcode-first match, then name.
      if (item.barcode) {
        const { data: hits } = await supabaseAdmin
          .from('catalog_products')
          .select('id')
          .eq('barcode', item.barcode)
          .limit(2)
        const list = (hits ?? []) as Array<{ id: string }>
        if (list.length === 1) {
          matched++
          rowInserts.push({
            job_id: (job as { id: string }).id,
            row_index: i,
            payload,
            decision: 'matched',
            matched_product_id: list[0]!.id,
            confidence: 1.0,
            reason: 'مطابقة باركود',
          })
          continue
        }
        if (list.length > 1) {
          ambiguous++
          rowInserts.push({
            job_id: (job as { id: string }).id,
            row_index: i,
            payload,
            decision: 'ambiguous',
            candidate_ids: list.map((r) => r.id),
            confidence: 0.6,
            reason: 'باركود مكرر',
          })
          continue
        }
      }

      const like = `%${item.name.replace(/[%_]/g, '')}%`
      const { data: byName } = await supabaseAdmin
        .from('catalog_products')
        .select('id, name_ar')
        .ilike('name_ar', like)
        .limit(5)
      const candidates = (byName ?? []) as Array<{ id: string; name_ar: string }>
      if (candidates.length === 0) {
        created++
        rowInserts.push({
          job_id: (job as { id: string }).id,
          row_index: i,
          payload,
          decision: 'new',
          confidence: 0.7,
          reason: 'صنف جديد — سيُنشأ عند التنفيذ',
        })
      } else if (candidates.length === 1) {
        matched++
        rowInserts.push({
          job_id: (job as { id: string }).id,
          row_index: i,
          payload,
          decision: 'matched',
          matched_product_id: candidates[0]!.id,
          confidence: 0.75,
          reason: 'مطابقة اسم',
        })
      } else {
        ambiguous++
        rowInserts.push({
          job_id: (job as { id: string }).id,
          row_index: i,
          payload,
          decision: 'ambiguous',
          candidate_ids: candidates.map((c) => c.id),
          confidence: 0.5,
          reason: `${candidates.length} مرشحين — يحتاج مراجعة`,
        })
      }
    }

    for (let i = 0; i < rowInserts.length; i += 500) {
      const { error } = await supabaseAdmin
        .from('catalog_import_rows')
        .insert(rowInserts.slice(i, i + 500) as never)
      if (error) throw new Error(`row insert failed: ${error.message}`)
    }

    await supabaseAdmin
      .from('catalog_import_jobs')
      .update({
        status: 'analyzed',
        matched_count: matched,
        new_count: created,
        ambiguous_count: ambiguous,
        invalid_count: invalid,
      } as never)
      .eq('id', (job as { id: string }).id)

    return {
      ok: true as const,
      job_id: (job as { id: string }).id,
      supplier_name: vision.data.supplier_name,
      counts: { matched, new: created, ambiguous, invalid },
      model: vision.model,
    }
  })

// ─── S4: BULK MEDIA LINK BY BARCODE ────────────────────────────────────────

export const linkMediaByBarcode = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z
      .object({
        barcode: z.string().min(3).max(60),
        storagePath: z.string().min(4),
        kind: z.enum(['primary', 'gallery', 'thumbnail']).default('gallery'),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId)

    const { data: product } = await context.supabase
      .from('catalog_products')
      .select('id, name_ar')
      .eq('barcode', data.barcode)
      .limit(2)

    const list = (product ?? []) as Array<{ id: string; name_ar: string }>
    if (list.length === 0) {
      return { ok: false as const, error: `لا يوجد منتج بالباركود ${data.barcode}` }
    }
    if (list.length > 1) {
      return { ok: false as const, error: `باركود مكرر (${list.length}) — راجع الكاتالوج` }
    }

    const productRow = list[0]!
    const { data: inserted, error } = await context.supabase
      .from('catalog_product_media')
      .insert({
        product_id: productRow.id,
        storage_bucket: 'product-images',
        storage_path: data.storagePath,
        kind: data.kind,
        status: 'approved',
        uploaded_by: context.userId,
        metadata: { linked_by_barcode: data.barcode },
      } as never)
      .select('id')
      .single()
    if (error) throw new Error(error.message)

    return {
      ok: true as const,
      media_id: (inserted as { id: string }).id,
      product_id: productRow.id,
      product_name: productRow.name_ar,
    }
  })

// ─── LIST PRODUCTS WITHOUT IMAGES (admin util) ────────────────────────────

export const listProductsMissingImages = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: rows, error: qErr } = await supabaseAdmin
      .from('catalog_products')
      .select('id, name_ar, barcode, brand')
      .eq('status', 'approved')
      .not('barcode', 'is', null)
      .limit(200)
    if (qErr) throw new Error(qErr.message)
    // Filter to those without approved media.

    const ids = ((rows ?? []) as Array<{ id: string }>).map((r) => r.id)
    if (ids.length === 0) return []
    const { data: media } = await supabaseAdmin
      .from('catalog_product_media')
      .select('product_id')
      .in('product_id', ids)
      .eq('status', 'approved')
    const withImg = new Set(((media ?? []) as Array<{ product_id: string }>).map((m) => m.product_id))
    return (rows ?? []).filter((r) => !withImg.has((r as { id: string }).id)) as Array<{
      id: string
      name_ar: string
      barcode: string | null
      brand: string | null
    }>
  })
