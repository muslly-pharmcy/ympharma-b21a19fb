import { describe, expect, it, vi } from 'vitest'
import {
  assertCatalogMediaReference, mediaAlt, PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_URL_TTL, signCatalogMedia, signPrimaryCatalogImages, validateProductImage,
  type CatalogMediaReference,
} from '../src/lib/catalog-media-policy'

const productId = '11111111-1111-4111-8111-111111111111'
const otherId = '22222222-2222-4222-8222-222222222222'
const row: CatalogMediaReference = {
  product_id: productId, storage_bucket: 'product-images',
  storage_path: `${productId}/image.png`, kind: 'primary', status: 'approved',
}

function storage() {
  const createSignedUrl = vi.fn(async () => ({ data: { signedUrl: 'https://images.example.test/signed' }, error: null }))
  const from = vi.fn(() => ({ createSignedUrl }))
  return { from, createSignedUrl }
}

describe('catalog image signing boundaries', () => {
  it.each([
    ['patient-prescriptions', `${productId}/image.png`],
    ['receipts', `${productId}/image.png`],
    ['product-images', `${otherId}/image.png`],
    ['product-images', `${productId}/../patient.png`],
    ['product-images', `${productId}/%2e%2e%2fpatient.png`],
    ['product-images', `${productId}/%252e%252e.png`],
    ['product-images', `${productId}/folder/image.png`],
    ['product-images', `${productId}/image\\patient.png`],
    ['product-images', `${productId}//image.png`],
    ['product-images', `${productId}/image.png?token=secret`],
    ['product-images', `${productId}/image\u0000.png`],
  ])('never accesses Storage for invalid bucket/path %s %s', async (bucket, path) => {
    const spy = storage()
    expect(() => assertCatalogMediaReference(productId, bucket, path)).toThrow()
    expect(await signCatalogMedia(spy, productId, { ...row, storage_bucket: bucket, storage_path: path })).toBeNull()
    expect(spy.from).not.toHaveBeenCalled()
  })

  it('signs a matching approved image with a short expiration and no private metadata in the result', async () => {
    const spy = storage()
    expect(await signCatalogMedia(spy, productId, row)).toBe('https://images.example.test/signed')
    expect(spy.from).toHaveBeenCalledWith('product-images')
    expect(spy.createSignedUrl).toHaveBeenCalledWith(row.storage_path, PRODUCT_IMAGE_URL_TTL)
    expect(PRODUCT_IMAGE_URL_TTL).toBeLessThanOrEqual(15 * 60)
  })

  it('does not sign pending or mismatched media on a public request', async () => {
    const spy = storage()
    expect(await signCatalogMedia(spy, productId, { ...row, status: 'pending' })).toBeNull()
    expect(await signCatalogMedia(spy, otherId, row)).toBeNull()
    expect(spy.from).not.toHaveBeenCalled()
    expect(await signCatalogMedia(spy, productId, { ...row, status: 'pending' }, true)).toBeTruthy()
  })

  it('keeps the public image fallback available when Storage signing fails', async () => {
    const spy = { from: () => ({ createSignedUrl: async () => ({ data: null, error: { message: 'missing object' } }) }) }
    expect(await signCatalogMedia(spy, productId, row)).toBeNull()
  })

  it('limits alt text and ignores other private metadata', () => {
    expect(mediaAlt({ alt_text: 'a'.repeat(300), patient: 'private' })).toHaveLength(200)
    expect(mediaAlt({ patient: 'private' })).toBeNull()
  })

  it('limits bulk previews to the explicitly authorized product IDs', async () => {
    const spy = storage()
    const outside = { ...row, product_id: otherId, storage_path: `${otherId}/outside.png` }
    const result = await signPrimaryCatalogImages(spy, [productId], [outside, row], true)
    expect([...result.keys()]).toEqual([productId])
    expect(spy.createSignedUrl).toHaveBeenCalledTimes(1)
    expect(spy.createSignedUrl).toHaveBeenCalledWith(row.storage_path, PRODUCT_IMAGE_URL_TTL)
  })

  it('allows pending primary admin previews without publishing them through public bulk signing', async () => {
    const spy = storage()
    const pending = { ...row, status: 'pending' }
    expect((await signPrimaryCatalogImages(spy, [productId], [pending])).size).toBe(0)
    expect(spy.from).not.toHaveBeenCalled()
    expect((await signPrimaryCatalogImages(spy, [productId], [pending], true)).get(productId)).toBeTruthy()
  })

  it('prefers a primary image and never displays rejected images as admin thumbnails', async () => {
    const spy = storage()
    const gallery = { ...row, kind: 'gallery', storage_path: `${productId}/gallery.png` }
    const rejected = { ...row, status: 'rejected', storage_path: `${productId}/rejected.png` }
    await signPrimaryCatalogImages(spy, [productId], [rejected, gallery, row], true)
    expect(spy.createSignedUrl).toHaveBeenCalledTimes(1)
    expect(spy.createSignedUrl).toHaveBeenCalledWith(row.storage_path, PRODUCT_IMAGE_URL_TTL)
  })
})

describe('product image upload validation', () => {
  it.each([
    ['image/png', [137, 80, 78, 71, 13, 10, 26, 10], 'png'],
    ['image/jpeg', [255, 216, 255, 224], 'jpg'],
    ['image/webp', [...new TextEncoder().encode('RIFF0000WEBPVP8 ')], 'webp'],
  ])('accepts matching %s content', async (mime, bytes, extension) => {
    expect(await validateProductImage(new Blob([new Uint8Array(bytes)], { type: mime }))).toEqual({ mime, extension })
  })

  it('rejects an executable renamed as an image, incorrect MIME, empty and oversized files', async () => {
    await expect(validateProductImage(new Blob(['<svg onload="alert(1)"/>'], { type: 'image/png' }))).rejects.toThrow()
    await expect(validateProductImage(new Blob([new Uint8Array([255, 216, 255])], { type: 'image/png' }))).rejects.toThrow()
    await expect(validateProductImage(new Blob(['payload'], { type: 'image/svg+xml' }))).rejects.toThrow()
    await expect(validateProductImage(new Blob([], { type: 'image/png' }))).rejects.toThrow()
    await expect(validateProductImage(new Blob([new Uint8Array(PRODUCT_IMAGE_MAX_BYTES + 1)], { type: 'image/png' }))).rejects.toThrow()
  })
})
