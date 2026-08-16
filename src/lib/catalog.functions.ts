import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  listProductsInputSchema,
  type CatalogCategory,
  type CatalogProduct,
  type ListProductsResult,
} from '@/domain/catalog/schemas'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'


// Escape PostgREST `.or()` reserved chars in user search input.
function escOr(v: string): string {
  return v.replace(/[,()*"']/g, ' ').trim()
}

// `catalog_products` has column-level SELECT grants for `anon`, so `select('*')`
// fails with "permission denied for table catalog_products". Public reads must
// project only the anon-readable columns.
const PUBLIC_PRODUCT_COLUMNS = [
  'id',
  'category_id',
  'name_ar',
  'name_en',
  'generic_name',
  'brand',
  'manufacturer',
  'manufacturer_country',
  'barcode',
  'active_ingredients',
  'dosage_form',
  'strength',
  'description_ar',
  'description_en',
  'status',
  'is_public',
  'requires_prescription',
  'sbdma_official_price',
  'store_code',
  'pack_unit',
  'image_url',
  'created_at',
  'updated_at',
].join(',')

const sel = (s: string): string => (s === '*' ? '*' : s)


// Wave R1.2 — Public Function Review.
// Verdict: Public by design (storefront browse). Hardened so the server
// always enforces the public gate (is_public AND status='approved'); the
// `publicOnly` input flag is accepted for compat but cannot be turned off
// from the client. Internal catalog surfaces must use authenticated fns.
export const listProducts = createServerFn({ method: 'GET' })
  .validator((raw: unknown) => listProductsInputSchema.parse(raw ?? {}))
  .handler(async ({ data }): Promise<ListProductsResult> => {
    const { getPublicSupabase } = await import('./supabase-public.server')
    const supabase = getPublicSupabase()

    const from = (data.page - 1) * data.pageSize
    const to = from + data.pageSize - 1

    let q = supabase
      .from('catalog_products')
      .select(PUBLIC_PRODUCT_COLUMNS, { count: 'exact' })
      .eq('is_public', true)
      .eq('status', 'approved')
      .order('updated_at', { ascending: false })
      .range(from, to)

    if (data.categoryId) q = q.eq('category_id', data.categoryId)
    if (data.search) {
      const term = `%${escOr(data.search)}%`
      q = q.or(
        `name_ar.ilike.${term},name_en.ilike.${term},generic_name.ilike.${term},brand.ilike.${term},barcode.ilike.${term}`,
      )
    }

    const { data: rows, error, count } = await q
    if (error) {
      console.error('[listProducts]', error)
      return { items: [], total: 0, page: data.page, pageSize: data.pageSize }
    }
    const items = (rows ?? []) as unknown as Array<CatalogProduct & { primary_image_url?: string }>

    // Bulk-fetch primary image (or first media) per product and sign URLs.
    if (items.length > 0) {
      try {
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const ids = items.map((p) => p.id)
        const { data: media } = await supabaseAdmin
          .from('catalog_product_media')
          .select('product_id, storage_bucket, storage_path, kind, sort_order, status')
          .in('product_id', ids)
          .eq('status', 'approved')
          .order('sort_order', { ascending: true })
        const byProduct = new Map<string, { bucket: string; path: string }>()
        for (const m of (media ?? []) as Array<{
          product_id: string
          storage_bucket: string | null
          storage_path: string
          kind: string
        }>) {
          if (!byProduct.has(m.product_id)) {
            byProduct.set(m.product_id, {
              bucket: m.storage_bucket || 'product-images',
              path: m.storage_path,
            })
          }
        }
        await Promise.all(
          Array.from(byProduct.entries()).map(async ([pid, ref]) => {
            const { data: signed } = await supabaseAdmin.storage
              .from(ref.bucket)
              .createSignedUrl(ref.path, 60 * 60 * 6)
            if (signed?.signedUrl) {
              const p = items.find((x) => x.id === pid)
              if (p) p.primary_image_url = signed.signedUrl
            }
          }),
        )
      } catch (e) {
        console.warn('[listProducts] image signing skipped:', (e as Error).message)
      }
    }

    return {
      items: items as unknown as CatalogProduct[],
      total: count ?? 0,
      page: data.page,
      pageSize: data.pageSize,
    }
  })

// ---------- AI: Product summary via Kernel ----------
// Authenticated. Uses the org-scoped Kernel dispatch with the
// `catalog_advisor` agent + `store_query` tool. Never bypasses Safety/Budget.
export const getProductAiSummary = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z.object({ productId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data }) => {
    const { dispatch } = await import('./ai/runtime/kernel.server')
    const { getActor } = await import('./session.server')
    const actor = await getActor()
    const res = await dispatch(actor, {
      agentKey: 'catalog_advisor',
      input: `اشرح لي هذا المنتج (المعرف: ${data.productId}) باستخدام أداة store_query.`,
      toolInputs: { store_query: { productId: data.productId } },
      tier: 'fast',
    })
    return {
      output: res.output,
      model: res.model,
      toolsUsed: res.toolsUsed,
      latencyMs: res.latencyMs,
    }
  })

// Public by design (product detail page). Server enforces the same
// is_public AND status='approved' gate so unpublished drafts stay hidden
// even if a UUID leaks.
export const getProduct = createServerFn({ method: 'GET' })
  .validator((raw: unknown) =>
    z.object({ id: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data }) => {
    const { getPublicSupabase } = await import('./supabase-public.server')
    const supabase = getPublicSupabase()

    const { data: product, error } = await supabase
      .from('catalog_products')
      .select(PUBLIC_PRODUCT_COLUMNS)
      .eq('id', data.id)
      .eq('is_public', true)
      .eq('status', 'approved')
      .maybeSingle()

    if (error || !product) return null

    const [{ data: barcodes }, { data: media }] = await Promise.all([
      supabase.from('catalog_barcodes').select(sel('*')).eq('product_id', data.id),
      supabase
        .from('catalog_product_media')
        .select(sel('*'))
        .eq('product_id', data.id)
        .order('sort_order', { ascending: true }),
    ])

    return {
      product: product as unknown as CatalogProduct,
      barcodes: barcodes ?? [],
      media: media ?? [],
    }
  })

export const listCategories = createServerFn({ method: 'GET' }).handler(
  async (): Promise<CatalogCategory[]> => {
    const { getPublicSupabase } = await import('./supabase-public.server')
    const supabase = getPublicSupabase()
    const { data, error } = await supabase
      .from('catalog_categories')
      .select(sel('*'))
      .is('organization_id', null)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
    if (error) {
      console.error('[listCategories]', error)
      return []
    }
    return (data ?? []) as unknown as CatalogCategory[]
  },
)
