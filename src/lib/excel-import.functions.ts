import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

// Bulk upsert products from a client-parsed Excel sheet.
// Admin-only. Client parses the .xlsx (with the `xlsx` package) and posts
// normalized rows here — we upsert into catalog_products (by store_code),
// then seed one FEFO batch per new product so it appears in the shop.
const RowSchema = z.object({
  store_code: z.string().min(1),
  name_ar: z.string().min(1),
  name_en: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  strength: z.string().optional().nullable(),
  dosage_form: z.string().optional().nullable(),
  price: z.number().finite().nonnegative().optional().nullable(),
  qty: z.number().finite().nonnegative().optional().nullable(),
  category_slug: z.string().optional().nullable(),
})
export type ExcelProductRow = z.infer<typeof RowSchema>

const DEFAULT_ORG = '11111111-1111-1111-1111-000000000001'
const DEFAULT_WH = '22222222-2222-2222-2222-000000000001'

export const bulkImportExcel = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z.object({ rows: z.array(RowSchema).min(1).max(5000) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context
    // Admin check
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: userId,
      _role: 'admin',
    })
    if (!isAdmin) throw new Error('Admin only')

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    // Preload category slug → id map (global categories)
    const { data: cats } = await supabaseAdmin
      .from('catalog_categories')
      .select('id, slug')
      .is('organization_id', null)
    const catMap = new Map<string, string>((cats ?? []).map((c: { id: string; slug: string }) => [c.slug, c.id]))

    let inserted = 0
    let updated = 0
    let skipped = 0
    const errors: Array<{ store_code: string; error: string }> = []

    for (const row of data.rows) {
      try {
        const category_id = row.category_slug ? catMap.get(row.category_slug) ?? null : null
        // Check existing by store_code
        const { data: existing } = await supabaseAdmin
          .from('catalog_products')
          .select('id')
          .eq('store_code', row.store_code)
          .maybeSingle()

        const payload = {
          store_code: row.store_code,
          name_ar: row.name_ar,
          name_en: row.name_en ?? null,
          brand: row.brand ?? null,
          manufacturer: row.manufacturer ?? null,
          barcode: row.barcode ?? null,
          strength: row.strength ?? null,
          dosage_form: row.dosage_form ?? null,
          sbdma_official_price: row.price ?? null,
          category_id,
          status: 'approved' as const,
          is_public: true,
          requires_prescription: false,
        }

        let productId: string
        if (existing?.id) {
          const { error } = await supabaseAdmin
            .from('catalog_products')
            .update(payload)
            .eq('id', existing.id)
          if (error) throw error
          productId = existing.id
          updated++
        } else {
          const { data: created, error } = await supabaseAdmin
            .from('catalog_products')
            .insert(payload)
            .select('id')
            .single()
          if (error) throw error
          productId = created.id
          inserted++
        }

        // Seed a stock batch if quantity provided and no batch exists yet
        const qty = Number(row.qty ?? 0)
        if (qty > 0) {
          const { data: batch } = await supabaseAdmin
            .from('inv_stock_batches')
            .select('id')
            .eq('product_id', productId)
            .eq('batch_no', 'EXCEL-IMPORT')
            .maybeSingle()
          if (batch?.id) {
            await supabaseAdmin
              .from('inv_stock_batches')
              .update({ qty_on_hand: qty })
              .eq('id', batch.id)
          } else {
            await supabaseAdmin.from('inv_stock_batches').insert({
              organization_id: DEFAULT_ORG,
              warehouse_id: DEFAULT_WH,
              product_id: productId,
              batch_no: 'EXCEL-IMPORT',
              qty_on_hand: qty,
              qty_reserved: 0,
              expiry_date: new Date(Date.now() + 540 * 86_400_000)
                .toISOString()
                .slice(0, 10),
              received_at: new Date().toISOString(),
            })
          }
        }
      } catch (e) {
        skipped++
        errors.push({ store_code: row.store_code, error: (e as Error).message })
      }
    }

    return { inserted, updated, skipped, total: data.rows.length, errors: errors.slice(0, 50) }
  })

// Read-only status of the image-generation queue (admin dashboard).
export const getImageQueueStats = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc('has_role', {
      _user_id: context.userId,
      _role: 'admin',
    })
    if (!isAdmin) throw new Error('Admin only')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data } = await supabaseAdmin
      .from('image_generation_queue')
      .select('status')
    const counts: Record<string, number> = {}
    for (const r of (data ?? []) as Array<{ status: string }>) {
      counts[r.status] = (counts[r.status] ?? 0) + 1
    }
    return { total: (data ?? []).length, by_status: counts }
  })
