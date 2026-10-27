import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'
import {
  assertCatalogMediaReference,
  PRODUCT_IMAGE_BUCKET,
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_MIME_TYPES,
  validateProductImage,
} from './catalog-media-policy'

export interface CatalogMediaContext {
  supabase: SupabaseClient<Database>
  userId: string
}

export async function authorizeCatalogProduct(context: CatalogMediaContext, productId: string, write = false) {
  const { getActorFromSupabase, requirePermission, requireOrg } = await import('./session.server')
  const actor = await getActorFromSupabase(context.supabase, context.userId)
  requirePermission(actor, write ? 'catalog.write' : 'catalog.read')
  const { data: product, error } = await context.supabase.from('catalog_products')
    .select('id, organization_id').eq('id', productId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!product) throw new Error('المنتج غير موجود')
  // Public or shared catalog visibility never grants ownership of its objects.
  if (!product.organization_id) throw new Error('يجب تحديد ملكية المنتج قبل إدارة صوره')
  requireOrg(actor, product.organization_id)
  return { actor, product }
}

async function databasePermission(context: CatalogMediaContext, orgId: string, permission: string) {
  const { data, error } = await context.supabase.rpc('has_org_permission', {
    _user_id: context.userId, _org_id: orgId, _permission: permission, _branch_id: undefined,
  })
  if (error) throw new Error('تعذر التحقق من صلاحيات صور المنتجات')
  return data === true
}

export function canReviewCatalogImages(context: CatalogMediaContext, orgId: string) {
  return databasePermission(context, orgId, 'catalog.media.review')
}

async function authorizeUpload(context: CatalogMediaContext, productId: string) {
  const authorization = await authorizeCatalogProduct(context, productId, true)
  const orgId = authorization.product.organization_id!
  if (!await databasePermission(context, orgId, 'catalog.media.upload')) throw new Error('لا تملك صلاحية رفع صور المنتجات')
  const canReview = await databasePermission(context, orgId, 'catalog.media.review')
  return { ...authorization, canReview }
}

type ImageInput = { productId: string; storagePath: string; bucket?: string; kind: 'primary' | 'gallery' | 'thumbnail'; altText?: string | null }
async function insertMedia(context: CatalogMediaContext, data: ImageInput, canReview: boolean, file?: Blob) {
  const status = canReview ? 'approved' as const : 'pending' as const
  const { data: inserted, error } = await context.supabase.from('catalog_product_media').insert({
    product_id: data.productId, storage_bucket: data.bucket ?? PRODUCT_IMAGE_BUCKET,
    storage_path: data.storagePath, kind: data.kind, status,
    uploaded_by: context.userId,
    reviewed_by: canReview ? context.userId : null,
    reviewed_at: canReview ? new Date().toISOString() : null,
    metadata: data.altText ? { alt_text: data.altText } : {},
    ...(file ? { bytes: file.size, mime: file.type } : {}),
  }).select('id').single()
  if (error || !inserted) throw new Error(error?.message ?? 'لم يتم تسجيل الصورة')
  return { ok: true as const, id: inserted.id, status }
}

export async function registerCatalogImage(context: CatalogMediaContext, data: ImageInput) {
  assertCatalogMediaReference(data.productId, data.bucket ?? PRODUCT_IMAGE_BUCKET, data.storagePath)
  const { canReview } = await authorizeUpload(context, data.productId)
  const object = await validateStoredCatalogImage(data.bucket ?? PRODUCT_IMAGE_BUCKET, data.storagePath)
  return insertMedia(context, data, canReview, object)
}

async function validateStoredCatalogImage(bucketName: string, storagePath: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const bucket = await supabaseAdmin.storage.getBucket(bucketName)
  if (bucket.error || !bucket.data || bucket.data.public) throw new Error('حاوية صور المنتجات الخاصة غير جاهزة')
  const info = await supabaseAdmin.storage.from(bucketName).info(storagePath)
  if (info.error || !info.data || !info.data.size || info.data.size > PRODUCT_IMAGE_MAX_BYTES) {
    throw new Error('ملف الصورة غير موجود أو يتجاوز 5 ميجابايت')
  }
  // Re-registration cannot bless an arbitrary non-image object from the bucket.
  const { data: object, error } = await supabaseAdmin.storage.from(bucketName).download(storagePath)
  if (error || !object) throw new Error('تعذر التحقق من ملف الصورة')
  await validateProductImage(object)
  return object
}

export async function approveCatalogImage(context: CatalogMediaContext, mediaId: string) {
  const { data: media, error } = await context.supabase.from('catalog_product_media')
    .select('id, product_id, storage_bucket, storage_path, status').eq('id', mediaId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!media) throw new Error('الصورة غير موجودة')
  const { product } = await authorizeCatalogProduct(context, media.product_id, true)
  if (!await canReviewCatalogImages(context, product.organization_id!)) throw new Error('لا تملك صلاحية اعتماد صور المنتجات')
  if (media.status !== 'pending') throw new Error('الصورة ليست بانتظار المراجعة')
  assertCatalogMediaReference(media.product_id, media.storage_bucket, media.storage_path)
  await validateStoredCatalogImage(media.storage_bucket, media.storage_path)
  const approved = await context.supabase.from('catalog_product_media').update({
    status: 'approved', reviewed_by: context.userId, reviewed_at: new Date().toISOString(),
  }).eq('id', media.id).eq('status', 'pending').select('id')
  if (approved.error || approved.data?.length !== 1) throw new Error('تعذر اعتماد الصورة؛ حدّث القائمة وأعد المحاولة')
  return { ok: true as const, id: media.id, status: 'approved' as const }
}

function storageStatus(error: unknown): number {
  if (!error || typeof error !== 'object') return 0
  if ('status' in error) return Number(error.status)
  if ('statusCode' in error) return Number(error.statusCode)
  return 0
}

export async function uploadCatalogImage(context: CatalogMediaContext, input: {
  productId: string; kind: ImageInput['kind']; altText?: string | null; file: Blob
}) {
  const { canReview } = await authorizeUpload(context, input.productId)
  const format = await validateProductImage(input.file)
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const storage = supabaseAdmin.storage
  let { data: bucket, error: bucketError } = await storage.getBucket(PRODUCT_IMAGE_BUCKET)
  if (bucketError && storageStatus(bucketError) === 404) {
    const created = await storage.createBucket(PRODUCT_IMAGE_BUCKET, {
      public: false, fileSizeLimit: PRODUCT_IMAGE_MAX_BYTES, allowedMimeTypes: PRODUCT_IMAGE_MIME_TYPES,
    })
    if (created.error && storageStatus(created.error) !== 409) throw new Error('تعذر تجهيز حاوية صور المنتجات')
    const reread = await storage.getBucket(PRODUCT_IMAGE_BUCKET)
    bucket = reread.data
    bucketError = reread.error
  }
  if (bucketError || !bucket || bucket.public) throw new Error('حاوية صور المنتجات الخاصة غير جاهزة')
  const storagePath = `${input.productId}/${crypto.randomUUID()}.${format.extension}`
  assertCatalogMediaReference(input.productId, PRODUCT_IMAGE_BUCKET, storagePath)
  const { error: uploadError } = await storage.from(PRODUCT_IMAGE_BUCKET).upload(storagePath, input.file, {
    upsert: false, contentType: format.mime, cacheControl: '900',
  })
  if (uploadError) throw new Error('فشل رفع الصورة')
  try {
    return await insertMedia(context, { ...input, storagePath }, canReview, input.file)
  } catch (error) {
    const cleanup = await storage.from(PRODUCT_IMAGE_BUCKET).remove([storagePath])
    if (cleanup.error) {
      const failure = new Error(`فشل تسجيل الصورة وتنظيف الملف؛ أعد المحاولة أو راجع الإدارة. المرجع: ${storagePath}`)
      Object.assign(failure, { cause: error })
      throw failure
    }
    throw error
  }
}

export async function deleteCatalogImage(context: CatalogMediaContext, mediaId: string) {
  const { data: media, error } = await context.supabase.from('catalog_product_media')
    .select('id, product_id, storage_bucket, storage_path').eq('id', mediaId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!media) throw new Error('الصورة غير موجودة')
  const { product } = await authorizeCatalogProduct(context, media.product_id, true)
  if (!await databasePermission(context, product.organization_id!, 'catalog.write')) {
    throw new Error('لا تملك صلاحية حذف صور المنتجات')
  }
  assertCatalogMediaReference(media.product_id, media.storage_bucket, media.storage_path)
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const removed = await supabaseAdmin.storage.from(media.storage_bucket).remove([media.storage_path])
  if (removed.error) throw new Error('تعذر حذف ملف الصورة؛ لم يُحذف سجلها ويمكن إعادة المحاولة')
  // Storage and Postgres cannot share a transaction. Retain the cleanup reference
  // on failure; removing an already absent object on retry is safe.
  const deleted = await context.supabase.from('catalog_product_media').delete().eq('id', media.id).select('id')
  if (deleted.error || deleted.data?.length !== 1) throw new Error('حُذف ملف الصورة وتعذر حذف سجلها؛ أعد محاولة الحذف')
  return { ok: true as const }
}
