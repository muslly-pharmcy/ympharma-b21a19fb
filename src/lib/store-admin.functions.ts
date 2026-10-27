import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { signPrimaryCatalogImages, type CatalogMediaReference } from './catalog-media-policy'

const uuid = z.string().uuid()

// ---------- Update product price (SBDMA official price) ----------
export const updateProductPrice = createServerFn({ method: 'POST' })
  .validator((raw: unknown) =>
    z.object({ productId: uuid, price: z.number().nonnegative() }).parse(raw),
  )
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'catalog.write')

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('catalog_products')
      .select('organization_id, sbdma_official_price')
      .eq('id', data.productId)
      .single()
    if (fetchErr) throw new Error(fetchErr.message)
    if (existing.organization_id !== actor.organizationId) {
      throw new Error('Forbidden: cross-org update')
    }

    const { error } = await supabaseAdmin
      .from('catalog_products')
      .update({ sbdma_official_price: data.price })
      .eq('id', data.productId)
    if (error) throw new Error(error.message)

    await audit(actor, {
      action: 'catalog.product.price',
      resourceType: 'catalog_product',
      resourceId: data.productId,
      payload: { before: existing.sbdma_official_price, after: data.price },
    })
    return { ok: true }
  })

// Compatibility for existing image-registration callers. Store the canonical
// media reference; expiring signed URLs never belong in catalog_products.
export const updateProductImage = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => z.object({
    productId: uuid, storagePath: z.string().min(1).max(500),
    bucket: z.enum(['product-images', 'catalog-media']).default('product-images'),
  }).parse(raw))
  .handler(async ({ data, context }) => {
    const { registerCatalogImage } = await import('./catalog-media-service.server')
    return registerCatalogImage(context, { ...data, kind: 'primary' })
  })

// ---------- Set absolute stock balance (creates single adjustment batch) ----------
export const setProductStockBalance = createServerFn({ method: 'POST' })
  .validator((raw: unknown) =>
    z
      .object({
        productId: uuid,
        newBalance: z.number().int().min(0),
        reason: z.string().min(2).max(200).default('admin manual set'),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'catalog.write')

    // Ensure product belongs to actor org
    const { data: p, error: pErr } = await supabaseAdmin
      .from('catalog_products')
      .select('organization_id')
      .eq('id', data.productId)
      .single()
    if (pErr) throw new Error(pErr.message)
    if (p.organization_id !== actor.organizationId) {
      throw new Error('Forbidden: cross-org update')
    }

    // Get / create default warehouse for this org
    const { data: wh } = await supabaseAdmin
      .from('wh_warehouses')
      .select('id')
      .eq('organization_id', actor.organizationId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    let warehouseId = wh?.id as string | undefined
    if (!warehouseId) {
      const { data: newWh, error: whErr } = await supabaseAdmin
        .from('wh_warehouses')
        .insert({
          organization_id: actor.organizationId,
          code: 'MAIN',
          name: 'المخزن الرئيسي',
          kind: 'central',
          is_active: true,
        })
        .select('id')
        .single()
      if (whErr) throw new Error(whErr.message)
      warehouseId = newWh.id
    }

    // Sum existing on-hand for this product in org
    const { data: existingBatches } = await supabaseAdmin
      .from('inv_stock_batches')
      .select('id, qty_on_hand')
      .eq('organization_id', actor.organizationId)
      .eq('product_id', data.productId)

    const currentTotal = ((existingBatches ?? []) as Array<{ qty_on_hand: number }>).reduce(
      (s, r) => s + Number(r.qty_on_hand ?? 0),
      0,
    )
    const delta = data.newBalance - currentTotal

    if (delta === 0) return { ok: true, delta: 0, newBalance: data.newBalance }

    // Add a single adjustment batch (positive) or reduce first batches (negative)
    if (delta > 0) {
      const { error } = await supabaseAdmin.from('inv_stock_batches').insert({
        organization_id: actor.organizationId,
        warehouse_id: warehouseId,
        product_id: data.productId,
        qty_on_hand: delta,
        qty_reserved: 0,
      })
      if (error) throw new Error(error.message)
    } else {
      let toRemove = -delta
      for (const b of (existingBatches ?? []) as Array<{ id: string; qty_on_hand: number }>) {
        if (toRemove <= 0) break
        const take = Math.min(Number(b.qty_on_hand ?? 0), toRemove)
        if (take <= 0) continue
        const newQty = Number(b.qty_on_hand) - take
        const { error } = await supabaseAdmin
          .from('inv_stock_batches')
          .update({ qty_on_hand: newQty })
          .eq('id', b.id)
        if (error) throw new Error(error.message)
        toRemove -= take
      }
    }

    await audit(actor, {
      action: 'catalog.product.stock_set',
      resourceType: 'catalog_product',
      resourceId: data.productId,
      payload: { delta, newBalance: data.newBalance, reason: data.reason },
    })

    return { ok: true, delta, newBalance: data.newBalance }
  })

// ---------- List for admin inventory table ----------
export const listStoreProductsAdmin = createServerFn({ method: 'GET' })
  .validator((raw: unknown) =>
    z
      .object({
        search: z.string().max(120).optional(),
        supplier: z.string().max(120).optional(),
        limit: z.number().int().min(1).max(500).default(100),
        offset: z.number().int().min(0).default(0),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const actor = await getActor()
    requirePermission(actor, 'catalog.write')

    let q = supabaseAdmin
      .from('store_products')
      .select('*', { count: 'exact' })
      .eq('organization_id', actor.organizationId)
      .neq('status', 'archived')
      .order('updated_at', { ascending: false })
      .range(data.offset, data.offset + data.limit - 1)

    if (data.search) {
      const term = `%${data.search.replace(/[,()*"']/g, ' ')}%`
      q = q.or(
        `name_ar.ilike.${term},name_en.ilike.${term},store_code.ilike.${term},barcode.ilike.${term}`,
      )
    }
    if (data.supplier) {
      q = q.ilike('supplier_name_text', `%${data.supplier}%`)
    }

    const { data: items, error, count } = await q
    if (error) throw new Error(error.message)
    const rows = items ?? []
    const ids = rows.flatMap((row) => row.id ? [row.id] : [])
    const imageUrls = new Map<string, string>()
    if (ids.length) {
      // Verify ownership from the base table before issuing private previews;
      // a public view row or a visible product alone never grants this access.
      const ownProducts = await supabaseAdmin.from('catalog_products').select('id')
        .in('id', ids).eq('organization_id', actor.organizationId)
      if (ownProducts.error) throw new Error(ownProducts.error.message)
      const ownIds = (ownProducts.data ?? []).map((product) => product.id)
      if (ownIds.length) {
        const media = await supabaseAdmin.from('catalog_product_media')
          .select('product_id, storage_bucket, storage_path, kind, status, sort_order')
          .in('product_id', ownIds).in('status', ['approved', 'pending'])
          .order('sort_order', { ascending: true }).order('created_at', { ascending: false })
        if (media.error) throw new Error(media.error.message)
        const signed = await signPrimaryCatalogImages(supabaseAdmin.storage, ownIds, (media.data ?? []) as CatalogMediaReference[], true)
        for (const [id, url] of signed) imageUrls.set(id, url)
      }
    }
    return { items: rows.map((row) => ({ ...row, primary_image_url: row.id ? imageUrls.get(row.id) ?? null : null })), total: count ?? 0 }
  })

// ---------- Create product (manual, before/alongside Oracle sync) ----------
// store_code is the shared key with the pharmacy Oracle system: if the same
// code arrives from the hourly sync, the sync updates this row instead of duplicating it.
export const createStoreProduct = createServerFn({ method: 'POST' })
  .validator((raw: unknown) =>
    z
      .object({
        name_ar: z.string().trim().min(2).max(200),
        store_code: z.string().trim().min(1).max(60),
        barcode: z.string().trim().max(60).optional(),
        price: z.number().nonnegative(),
        requires_prescription: z.boolean().default(false),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'catalog.write')

    const { data: row, error } = await supabaseAdmin
      .from('catalog_products')
      .insert({
        organization_id: actor.organizationId,
        owner_org_id: actor.organizationId,
        name_ar: data.name_ar,
        store_code: data.store_code,
        barcode: data.barcode || null,
        sbdma_official_price: data.price,
        requires_prescription: data.requires_prescription,
        status: 'approved',
        is_public: true,
        created_by: actor.userId,
      } as never)
      .select('id')
      .single()
    if (error) {
      if (error.code === '23505') throw new Error('هذا الكود مستخدم لصنف آخر')
      throw new Error(error.message)
    }
    await audit(actor, { action: 'catalog.product.create', resourceType: 'catalog_product', resourceId: row.id, payload: data })
    return { id: row.id as string }
  })

// ---------- Delete product (soft: archived + hidden from store, keeps order history) ----------
export const deleteStoreProduct = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => z.object({ productId: uuid }).parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'catalog.write')

    const { data: p, error: pErr } = await supabaseAdmin
      .from('catalog_products')
      .select('organization_id')
      .eq('id', data.productId)
      .single()
    if (pErr) throw new Error(pErr.message)
    if (p.organization_id !== actor.organizationId) throw new Error('Forbidden: cross-org update')

    const { error } = await supabaseAdmin
      .from('catalog_products')
      .update({ status: 'archived', is_public: false })
      .eq('id', data.productId)
    if (error) throw new Error(error.message)
    await audit(actor, { action: 'catalog.product.archive', resourceType: 'catalog_product', resourceId: data.productId })
    return { ok: true }
  })
