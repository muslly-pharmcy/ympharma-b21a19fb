export const PRODUCT_IMAGE_BUCKET = 'product-images'
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const PRODUCT_IMAGE_URL_TTL = 15 * 60
export const PRODUCT_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export interface CatalogMediaReference {
  product_id: string
  storage_bucket: string
  storage_path: string
  kind: string
  status: string
  metadata?: unknown
}

// Storage paths are canonical object keys, never URLs or user-controlled bucket
// selectors. Restrict these signers to a single product's catalog images.
export function assertCatalogMediaReference(productId: string, bucket: string, path: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(productId)) {
    throw new Error('معرف المنتج غير صالح')
  }
  if (bucket !== PRODUCT_IMAGE_BUCKET && bucket !== 'catalog-media') {
    throw new Error('حاوية الصور غير مسموحة')
  }
  if (path.length > 500 || !path.startsWith(`${productId}/`)) {
    throw new Error('مسار الصورة لا يخص المنتج')
  }
  const filename = path.slice(productId.length + 1)
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,240}$/.test(filename) || filename.includes('..')) {
    throw new Error('مسار الصورة غير صالح')
  }
}

export function mediaAlt(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || !('alt_text' in metadata)) return null
  return typeof metadata.alt_text === 'string' ? metadata.alt_text.slice(0, 200) : null
}

export interface MediaSigner {
  from(bucket: string): {
    createSignedUrl(path: string, ttl: number): PromiseLike<{
      data: { signedUrl: string } | null
      error: unknown
    }>
  }
}

export async function signCatalogMedia(
  storage: MediaSigner,
  productId: string,
  media: CatalogMediaReference,
  allowPending = false,
): Promise<string | null> {
  if (media.product_id !== productId || (!allowPending && media.status !== 'approved')) return null
  try {
    assertCatalogMediaReference(productId, media.storage_bucket, media.storage_path)
  } catch {
    return null
  }
  const { data, error } = await storage.from(media.storage_bucket)
    .createSignedUrl(media.storage_path, PRODUCT_IMAGE_URL_TTL)
  return error ? null : data?.signedUrl ?? null
}

export async function signPrimaryCatalogImages(
  storage: MediaSigner, productIds: string[], media: CatalogMediaReference[], allowPending = false,
) {
  const result = new Map<string, string>()
  await Promise.all(productIds.map(async (productId) => {
    const candidates = media.filter((row) => row.product_id === productId && (row.status === 'approved' || (allowPending && row.status === 'pending')))
      .sort((a, b) => Number(b.kind === 'primary') - Number(a.kind === 'primary'))
    for (const candidate of candidates) {
      const url = await signCatalogMedia(storage, productId, candidate, allowPending)
      if (url) { result.set(productId, url); break }
    }
  }))
  return result
}

export async function validateProductImage(file: Blob): Promise<{ mime: string; extension: string }> {
  if (file.size === 0 || file.size > PRODUCT_IMAGE_MAX_BYTES) throw new Error('حجم الصورة يجب ألا يتجاوز 5 ميجابايت')
  if (!PRODUCT_IMAGE_MIME_TYPES.includes(file.type)) throw new Error('الصور المسموحة: JPEG وPNG وWebP')
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  const webp = bytes.length >= 16 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
    && ['VP8 ', 'VP8L', 'VP8X'].includes(String.fromCharCode(...bytes.slice(12, 16)))
  const format = png ? { mime: 'image/png', extension: 'png' }
    : jpeg ? { mime: 'image/jpeg', extension: 'jpg' }
      : webp ? { mime: 'image/webp', extension: 'webp' } : null
  if (!format || format.mime !== file.type) throw new Error('محتوى الصورة لا يطابق نوع الملف')
  return format
}
