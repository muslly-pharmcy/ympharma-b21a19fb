import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { mediaAlt, signCatalogMedia, type CatalogMediaReference } from './catalog-media-policy'

const imageInput = z.object({
  productId: z.string().uuid(),
  storagePath: z.string().min(4).max(500),
  kind: z.enum(['primary', 'gallery', 'thumbnail']).default('gallery'),
  altText: z.string().max(200).optional().nullable(),
})

export const registerProductImage = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => imageInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { registerCatalogImage } = await import('./catalog-media-service.server')
    return registerCatalogImage(context, data)
  })

export const uploadProductImage = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => {
    if (!(raw instanceof FormData)) throw new Error('طلب رفع الصورة غير صالح')
    const data = imageInput.omit({ storagePath: true }).parse({
      productId: raw.get('productId'), kind: raw.get('kind') ?? 'gallery', altText: raw.get('altText'),
    })
    const file = raw.get('file')
    if (!(file instanceof Blob)) throw new Error('يرجى اختيار صورة')
    return { ...data, file }
  })
  .handler(async ({ data, context }) => {
    const { uploadCatalogImage } = await import('./catalog-media-service.server')
    return uploadCatalogImage(context, data)
  })

export const deleteProductImage = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => z.object({ mediaId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { deleteCatalogImage } = await import('./catalog-media-service.server')
    return deleteCatalogImage(context, data.mediaId)
  })

export const approveProductImage = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => z.object({ mediaId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { approveCatalogImage } = await import('./catalog-media-service.server')
    return approveCatalogImage(context, data.mediaId)
  })

// Raw references and draft previews are organization-scoped administration.
export const listAdminProductImages = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => z.object({ productId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { authorizeCatalogProduct, canReviewCatalogImages } = await import('./catalog-media-service.server')
    const { actor, product } = await authorizeCatalogProduct(context, data.productId)
    const { hasPermission } = await import('./session.server')
    const canApprove = hasPermission(actor, 'catalog.write') && await canReviewCatalogImages(context, product.organization_id!)
    const result = await context.supabase.from('catalog_product_media')
      .select('id, product_id, storage_bucket, storage_path, kind, status, metadata, sort_order')
      .eq('product_id', data.productId).order('sort_order', { ascending: true }).order('created_at', { ascending: false })
    if (result.error) throw new Error(result.error.message)
    const { isSupabaseAdminConfigured, supabaseAdmin } = await import('@/integrations/supabase/client.server')
    return Promise.all((result.data ?? []).map(async (media) => ({
      id: media.id, kind: media.kind, status: media.status, storage_path: media.storage_path, canApprove,
      alt: mediaAlt(media.metadata),
      url: isSupabaseAdminConfigured()
        ? await signCatalogMedia(supabaseAdmin.storage, data.productId, media as CatalogMediaReference, true)
        : null,
    })))
  })
