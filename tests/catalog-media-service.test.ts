import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CatalogMediaContext } from '@/lib/catalog-media-service.server'

const mocks = vi.hoisted(() => ({
  getActor: vi.fn(),
  requirePermission: vi.fn(),
  requireOrg: vi.fn(),
  storageAccess: vi.fn(),
  storage: { getBucket: vi.fn(), createBucket: vi.fn(), from: vi.fn() },
  object: { upload: vi.fn(), remove: vi.fn(), download: vi.fn(), info: vi.fn() },
}))

vi.mock('@/lib/session.server', () => ({
  getActorFromSupabase: mocks.getActor,
  requirePermission: mocks.requirePermission,
  requireOrg: mocks.requireOrg,
}))
vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: {
    get storage() {
      mocks.storageAccess()
      return mocks.storage
    },
  },
}))

import { approveCatalogImage, deleteCatalogImage, registerCatalogImage, uploadCatalogImage } from '@/lib/catalog-media-service.server'

const productId = '11111111-1111-4111-8111-111111111111'
const orgId = '22222222-2222-4222-8222-222222222222'
const mediaId = '33333333-3333-4333-8333-333333333333'
const storagePath = `${productId}/synthetic-image.png`
const validPng = () => new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 0, 0, 0, 0])], { type: 'image/png' })

type QueryResult = { data: unknown; error: { message: string } | null }
let actor: { userId: string; organizationId: string; permissions: string[] }
let product: { id: string; organization_id: string | null }
let media: { id: string; product_id: string; storage_bucket: string; storage_path: string; status: string }
let canReview: boolean
let canUpload: boolean
let rpcError: { message: string } | null
let insertResult: QueryResult
let deleteResult: QueryResult
let updateResult: QueryResult
let updateFilters: Array<[string, unknown]>
let context: CatalogMediaContext
let insert: ReturnType<typeof vi.fn>
let deleteMetadata: ReturnType<typeof vi.fn>
let updateMetadata: ReturnType<typeof vi.fn>
let rpc: ReturnType<typeof vi.fn>
let events: string[]

beforeEach(() => {
  vi.resetAllMocks()
  actor = { userId: 'synthetic-caller', organizationId: orgId, permissions: ['catalog.read', 'catalog.write'] }
  product = { id: productId, organization_id: orgId }
  media = { id: mediaId, product_id: productId, storage_bucket: 'product-images', storage_path: storagePath, status: 'pending' }
  canReview = false
  canUpload = true
  rpcError = null
  insertResult = { data: { id: mediaId }, error: null }
  deleteResult = { data: [{ id: mediaId }], error: null }
  updateResult = { data: [{ id: mediaId }], error: null }
  updateFilters = []
  events = []

  mocks.getActor.mockImplementation(async () => { events.push('actor'); return actor })
  mocks.requirePermission.mockImplementation((current, permission) => {
    events.push(`permission:${permission}`)
    if (!current.permissions.includes(permission)) throw new Error('Forbidden: permission')
  })
  mocks.requireOrg.mockImplementation((current, organizationId) => {
    events.push('organization')
    if (current.organizationId !== organizationId) throw new Error('Forbidden: cross-org')
  })
  rpc = vi.fn(async (_name, args) => {
    events.push(`database:${args._permission}`)
    return { data: args._permission === 'catalog.media.review' ? canReview : canUpload, error: rpcError }
  })
  insert = vi.fn(() => ({ select: () => ({ single: async () => insertResult }) }))
  deleteMetadata = vi.fn(() => ({ eq: () => ({ select: async () => deleteResult }) }))
  const updateQuery = {
    eq: (column: string, value: unknown) => { updateFilters.push([column, value]); return updateQuery },
    select: async () => updateResult,
  }
  updateMetadata = vi.fn(() => updateQuery)
  const productsQuery = {
    select: () => productsQuery,
    eq: () => productsQuery,
    maybeSingle: async () => ({ data: product, error: null }),
  }
  const mediaQuery = {
    select: () => mediaQuery,
    eq: () => mediaQuery,
    maybeSingle: async () => ({ data: media, error: null }),
    insert,
    delete: deleteMetadata,
    update: updateMetadata,
  }
  context = {
    userId: actor.userId,
    supabase: {
      from: vi.fn((table) => {
        if (table === 'catalog_products') return productsQuery
        if (table === 'catalog_product_media') return mediaQuery
        throw new Error(`Unexpected synthetic table: ${table}`)
      }),
      rpc,
    } as unknown as CatalogMediaContext['supabase'],
  }
  mocks.storage.getBucket.mockImplementation(async () => { events.push('storage:getBucket'); return { data: { id: 'product-images', public: false }, error: null } })
  mocks.storage.createBucket.mockResolvedValue({ data: { name: 'product-images' }, error: null })
  mocks.storage.from.mockReturnValue(mocks.object)
  mocks.object.upload.mockResolvedValue({ data: { path: storagePath }, error: null })
  mocks.object.remove.mockResolvedValue({ data: [{ name: storagePath }], error: null })
  mocks.object.download.mockResolvedValue({ data: validPng(), error: null })
  mocks.object.info.mockResolvedValue({ data: { size: validPng().size, contentType: 'image/png' }, error: null })
})

const upload = () => uploadCatalogImage(context, { productId, kind: 'primary', file: validPng(), altText: 'صورة اختبار اصطناعية' })

function expectNoPrivilegedStorage() {
  expect(mocks.storageAccess).not.toHaveBeenCalled()
  expect(mocks.storage.from).not.toHaveBeenCalled()
  expect(mocks.storage.getBucket).not.toHaveBeenCalled()
  expect(mocks.storage.createBucket).not.toHaveBeenCalled()
}

describe('catalog media mutation authorization', () => {
  it.each(['upload', 'delete'] as const)('rejects a viewer before privileged storage for %s', async (operation) => {
    actor.permissions = ['catalog.read']
    await expect(operation === 'upload' ? upload() : deleteCatalogImage(context, mediaId)).rejects.toThrow('Forbidden: permission')
    expect(mocks.getActor).toHaveBeenCalledWith(context.supabase, context.userId)
    expectNoPrivilegedStorage()
    expect(insert).not.toHaveBeenCalled()
    expect(deleteMetadata).not.toHaveBeenCalled()
  })

  it.each(['upload', 'delete'] as const)('rejects another organization before privileged storage for %s', async (operation) => {
    product.organization_id = '99999999-9999-4999-8999-999999999999'
    await expect(operation === 'upload' ? upload() : deleteCatalogImage(context, mediaId)).rejects.toThrow('Forbidden: cross-org')
    expectNoPrivilegedStorage()
  })

  it('does not let public shared catalog visibility become upload ownership', async () => {
    product.organization_id = null
    await expect(upload()).rejects.toThrow('ملكية المنتج')
    expectNoPrivilegedStorage()
  })

  it('requires the database upload grant before provisioning storage', async () => {
    canUpload = false
    await expect(upload()).rejects.toThrow('صلاحية رفع')
    expectNoPrivilegedStorage()
  })

  it('fails closed when database permission lookup fails', async () => {
    rpcError = { message: 'synthetic permission outage' }
    await expect(upload()).rejects.toThrow('التحقق من صلاحيات')
    expectNoPrivilegedStorage()
  })
})

describe('authorized image upload', () => {
  it.each([false, true])('stores canonical media with review permission %s', async (review) => {
    canReview = review
    const result = await upload()
    expect(result).toEqual({ ok: true, id: mediaId, status: review ? 'approved' : 'pending' })
    expect(rpc).toHaveBeenCalledWith('has_org_permission', expect.objectContaining({ _user_id: context.userId, _org_id: orgId, _permission: 'catalog.media.review' }))
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      product_id: productId,
      storage_bucket: 'product-images',
      storage_path: expect.stringMatching(new RegExp(`^${productId}/[a-f0-9-]+\\.png$`)),
      status: review ? 'approved' : 'pending',
      reviewed_by: review ? context.userId : null,
      uploaded_by: context.userId,
      metadata: { alt_text: 'صورة اختبار اصطناعية' },
    }))
    expect(mocks.object.upload).toHaveBeenCalledWith(expect.any(String), expect.any(Blob), { upsert: false, contentType: 'image/png', cacheControl: '900' })
    expect(mocks.storage.createBucket).not.toHaveBeenCalled()
  })

  it('creates only a private image bucket after caller and database authorization', async () => {
    mocks.storage.getBucket.mockResolvedValueOnce({ data: null, error: { status: 404 } })
    await upload()
    expect(mocks.storage.createBucket).toHaveBeenCalledWith('product-images', {
      public: false,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    })
    expect(mocks.storage.getBucket).toHaveBeenCalledTimes(2)
    expect(events.slice(0, 5)).toEqual(['actor', 'permission:catalog.write', 'organization', 'database:catalog.media.upload', 'database:catalog.media.review'])
  })

  it('refuses an existing public bucket without changing its flags', async () => {
    mocks.storage.getBucket.mockResolvedValue({ data: { id: 'product-images', public: true }, error: null })
    await expect(upload()).rejects.toThrow('حاوية صور المنتجات الخاصة')
    expect(mocks.storage.createBucket).not.toHaveBeenCalled()
    expect(mocks.object.upload).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
  })

  it('does not mistake a storage outage for a missing bucket', async () => {
    mocks.storage.getBucket.mockResolvedValue({ data: null, error: { status: 503 } })
    await expect(upload()).rejects.toThrow('غير جاهزة')
    expect(mocks.storage.createBucket).not.toHaveBeenCalled()
    expect(mocks.object.upload).not.toHaveBeenCalled()
  })

  it('does not create metadata when the object upload fails', async () => {
    mocks.object.upload.mockResolvedValue({ data: null, error: { message: 'synthetic storage outage' } })
    await expect(upload()).rejects.toThrow('فشل رفع')
    expect(insert).not.toHaveBeenCalled()
    expect(mocks.object.remove).not.toHaveBeenCalled()
  })

  it('removes its fresh object if metadata insertion fails, and reports the failure', async () => {
    insertResult = { data: null, error: { message: 'synthetic insert denial' } }
    await expect(upload()).rejects.toThrow('synthetic insert denial')
    const path = mocks.object.upload.mock.calls[0][0]
    expect(mocks.object.remove).toHaveBeenCalledWith([path])
  })

  it('reports a failed cleanup with a retry reference instead of success', async () => {
    insertResult = { data: null, error: { message: 'synthetic insert denial' } }
    mocks.object.remove.mockResolvedValue({ data: null, error: { message: 'synthetic cleanup outage' } })
    await expect(upload()).rejects.toThrow(/فشل تسجيل الصورة وتنظيف الملف.*المرجع:/)
    expect(mocks.object.remove).toHaveBeenCalledTimes(1)
  })

  it('rejects mismatched image bytes before accessing privileged storage', async () => {
    const file = new Blob(['synthetic executable'], { type: 'image/png' })
    await expect(uploadCatalogImage(context, { productId, kind: 'gallery', file })).rejects.toThrow('لا يطابق')
    expectNoPrivilegedStorage()
    expect(insert).not.toHaveBeenCalled()
  })
})

describe('catalog image deletion and retry behavior', () => {
  it.each([
    { storage_bucket: 'patient-prescriptions', storage_path: storagePath },
    { storage_bucket: 'product-images', storage_path: `${productId}/../prescription.png` },
    { storage_bucket: 'product-images', storage_path: '99999999-9999-4999-8999-999999999999/image.png' },
    { storage_bucket: 'catalog-media', storage_path: `${productId}/%2e%2e%2fimage.png` },
  ])('never removes an invalid catalog reference: %j', async (reference) => {
    Object.assign(media, reference)
    await expect(deleteCatalogImage(context, mediaId)).rejects.toThrow()
    expectNoPrivilegedStorage()
    expect(deleteMetadata).not.toHaveBeenCalled()
  })

  it('preserves metadata when storage deletion fails', async () => {
    mocks.object.remove.mockResolvedValue({ data: null, error: { message: 'synthetic storage outage' } })
    await expect(deleteCatalogImage(context, mediaId)).rejects.toThrow('لم يُحذف سجلها')
    expect(deleteMetadata).not.toHaveBeenCalled()
  })

  it.each([
    { data: [], error: null },
    { data: null, error: { message: 'synthetic metadata denial' } },
  ])('reports metadata deletion failure and permits a retry: %j', async (failure) => {
    deleteResult = failure
    await expect(deleteCatalogImage(context, mediaId)).rejects.toThrow('أعد محاولة الحذف')
    expect(mocks.object.remove).toHaveBeenCalledWith([storagePath])
    expect(deleteMetadata).toHaveBeenCalledTimes(1)
    // The failed metadata mutation retained its reference. Removing the now
    // absent object succeeds idempotently before retrying the database delete.
    deleteResult = { data: [{ id: mediaId }], error: null }
    await expect(deleteCatalogImage(context, mediaId)).resolves.toEqual({ ok: true })
    expect(mocks.object.remove).toHaveBeenCalledTimes(2)
    expect(deleteMetadata).toHaveBeenCalledTimes(2)
  })

  it('removes a valid own-organization object and exactly one metadata row', async () => {
    await expect(deleteCatalogImage(context, mediaId)).resolves.toEqual({ ok: true })
    expect(mocks.storage.from).toHaveBeenCalledWith('product-images')
    expect(mocks.object.remove).toHaveBeenCalledWith([storagePath])
    expect(deleteMetadata).toHaveBeenCalledTimes(1)
  })
})

describe('registering an existing private object', () => {
  it('validates and keeps an uploaded object pending without review permission', async () => {
    await expect(registerCatalogImage(context, { productId, storagePath, kind: 'gallery' })).resolves.toEqual({ ok: true, id: mediaId, status: 'pending' })
    expect(mocks.object.download).toHaveBeenCalledWith(storagePath)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending', storage_path: storagePath }))
  })

  it('refuses registering a non-image object despite a valid product path', async () => {
    mocks.object.download.mockResolvedValue({ data: new Blob(['not an image'], { type: 'image/png' }), error: null })
    await expect(registerCatalogImage(context, { productId, storagePath, kind: 'gallery' })).rejects.toThrow('لا يطابق')
    expect(insert).not.toHaveBeenCalled()
  })
})


describe('catalog image approval', () => {
  beforeEach(() => { canReview = true })

  it('rejects a viewer before privileged storage or metadata update', async () => {
    actor.permissions = ['catalog.read']
    await expect(approveCatalogImage(context, mediaId)).rejects.toThrow('Forbidden: permission')
    expectNoPrivilegedStorage()
    expect(updateMetadata).not.toHaveBeenCalled()
  })

  it('rejects a reviewer from another organization before privileged storage', async () => {
    product.organization_id = '99999999-9999-4999-8999-999999999999'
    await expect(approveCatalogImage(context, mediaId)).rejects.toThrow('Forbidden: cross-org')
    expectNoPrivilegedStorage()
    expect(updateMetadata).not.toHaveBeenCalled()
  })

  it('requires the database review grant even for a catalog writer', async () => {
    canReview = false
    await expect(approveCatalogImage(context, mediaId)).rejects.toThrow()
    expect(rpc).toHaveBeenCalledWith('has_org_permission', expect.objectContaining({ _org_id: orgId, _permission: 'catalog.media.review' }))
    expectNoPrivilegedStorage()
    expect(updateMetadata).not.toHaveBeenCalled()
  })

  it('fails closed if database review permission cannot be checked', async () => {
    rpcError = { message: 'synthetic review permission outage' }
    await expect(approveCatalogImage(context, mediaId)).rejects.toThrow()
    expectNoPrivilegedStorage()
    expect(updateMetadata).not.toHaveBeenCalled()
  })

  it.each([
    { storage_bucket: 'patient-prescriptions', storage_path: storagePath },
    { storage_bucket: 'product-images', storage_path: `${productId}/../patient.png` },
    { storage_bucket: 'product-images', storage_path: '99999999-9999-4999-8999-999999999999/image.png' },
  ])('never inspects or approves invalid object references: %j', async (reference) => {
    Object.assign(media, reference)
    await expect(approveCatalogImage(context, mediaId)).rejects.toThrow()
    expectNoPrivilegedStorage()
    expect(updateMetadata).not.toHaveBeenCalled()
  })

  it('rejects a stored object whose bytes do not match an image', async () => {
    mocks.object.download.mockResolvedValue({ data: new Blob(['synthetic non-image'], { type: 'image/png' }), error: null })
    await expect(approveCatalogImage(context, mediaId)).rejects.toThrow()
    expect(updateMetadata).not.toHaveBeenCalled()
  })

  it('refuses public bucket approval without changing its configuration', async () => {
    mocks.storage.getBucket.mockResolvedValue({ data: { id: 'product-images', public: true }, error: null })
    await expect(approveCatalogImage(context, mediaId)).rejects.toThrow()
    expect(mocks.storage.createBucket).not.toHaveBeenCalled()
    expect(updateMetadata).not.toHaveBeenCalled()
  })

  it.each(['approved', 'rejected', 'archived'])('does not approve a %s row', async (status) => {
    media.status = status
    await expect(approveCatalogImage(context, mediaId)).rejects.toThrow()
    expectNoPrivilegedStorage()
    expect(updateMetadata).not.toHaveBeenCalled()
  })

  it('approves exactly one pending image after authorization and object validation', async () => {
    await expect(approveCatalogImage(context, mediaId)).resolves.toMatchObject({ ok: true })
    expect(mocks.object.download).toHaveBeenCalledWith(storagePath)
    expect(updateMetadata).toHaveBeenCalledWith(expect.objectContaining({
      status: 'approved', reviewed_by: context.userId, reviewed_at: expect.any(String),
    }))
    expect(updateFilters).toEqual(expect.arrayContaining([['id', mediaId], ['status', 'pending']]))
    expect(mocks.object.upload).not.toHaveBeenCalled()
    expect(mocks.object.remove).not.toHaveBeenCalled()
  })

  it.each([
    { data: [], error: null },
    { data: null, error: { message: 'synthetic approval update failure' } },
  ])('reports failed or raced approval updates without success: %j', async (failure) => {
    updateResult = failure
    await expect(approveCatalogImage(context, mediaId)).rejects.toThrow()
    expect(updateMetadata).toHaveBeenCalledTimes(1)
    expect(updateFilters).toEqual(expect.arrayContaining([['id', mediaId], ['status', 'pending']]))
  })
})
