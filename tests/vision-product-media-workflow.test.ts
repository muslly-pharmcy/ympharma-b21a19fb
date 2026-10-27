import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  actor: { userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', organizationId: 'org-a' },
  canWrite: true,
  getActor: vi.fn(),
  requirePermission: vi.fn(),
  upload: vi.fn(),
  register: vi.fn(),
  storageAccess: vi.fn(),
  storageFrom: vi.fn(),
  signRead: vi.fn(),
  callVision: vi.fn(),
}))

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    type Args = { data: unknown; context: unknown }
    type Builder = {
      middleware: () => Builder
      validator: (fn: (raw: unknown) => unknown) => Builder
      handler: (fn: (args: Args) => unknown, original?: (args: Args) => unknown) => ((args: Args) => unknown) & { __executeServer: (args: Args) => unknown }
    }
    let validate: (raw: unknown) => unknown = (raw) => raw
    const builder: Builder = {
      middleware: () => builder,
      validator: (fn) => { validate = fn; return builder },
      handler: (fn, original) => {
        const execute = (args: Args) => (original ?? fn)({ ...args, data: validate(args.data) })
        return Object.assign(execute, { __executeServer: execute })
      },
    }
    return builder
  },
}))
vi.mock('@tanstack/react-start/server-rpc', () => ({ createServerRpc: (_meta: unknown, fn: unknown) => fn }))
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }))
vi.mock('@/lib/session.server', () => ({
  getActorFromSupabase: mocks.getActor,
  requirePermission: mocks.requirePermission,
}))
vi.mock('@/lib/catalog-media-service.server', () => ({
  uploadCatalogImage: mocks.upload,
  registerCatalogImage: mocks.register,
}))
vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: {
    get storage() { mocks.storageAccess(); return { from: mocks.storageFrom } },
  },
}))
vi.mock('@/lib/ai/vision.server', () => ({ callVision: mocks.callVision }))

// TanStack exposes these provider handlers only through its compiler query.
// @ts-expect-error -- the emitted handler exports are unavailable to TypeScript.
import * as provider from '@/lib/vision.functions?tss-serverfn-split'
const {
  analyzeInvoiceImage_createServerFn_handler: analyzeInvoiceImage,
  analyzePrescriptionImage_createServerFn_handler: analyzePrescriptionImage,
  createVisionUploadUrl_createServerFn_handler: createVisionUploadUrl,
  linkMediaByBarcode_createServerFn_handler: linkMediaByBarcode,
  uploadProductImageByBarcode_createServerFn_handler: uploadProductImageByBarcode,
} = provider


let isAdmin: boolean
let products: Array<{ id: string; name_ar: string }>
let queryError: { message: string } | null
let filters: Array<[string, unknown]>
let context: { userId: string; supabase: { from: ReturnType<typeof vi.fn>; rpc: ReturnType<typeof vi.fn> } }

function invoke(fn: unknown, data: unknown): Promise<Record<string, unknown>> {
  return Promise.resolve().then(() => (fn as (args: { data: unknown; context: unknown }) => Promise<Record<string, unknown>>)({ data, context }))
}

function imageForm() {
  const data = new FormData()
  data.set('barcode', '6221234567890')
  data.set('kind', 'primary')
  data.set('file', new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' }), '6221234567890.png')
  return data
}

beforeEach(() => {
  vi.resetAllMocks()
  isAdmin = true
  mocks.canWrite = true
  products = [{ id: '11111111-1111-4111-8111-111111111111', name_ar: 'منتج اصطناعي' }]
  queryError = null
  filters = []
  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => { filters.push([column, value]); return query },
    limit: async () => ({ data: products, error: queryError }),
  }
  context = {
    userId: mocks.actor.userId,
    supabase: {
      from: vi.fn((table: string) => {
        if (table !== 'catalog_products') throw new Error('Unexpected synthetic table')
        return query
      }),
      rpc: vi.fn(async () => ({ data: isAdmin, error: null })),
    },
  }
  mocks.getActor.mockResolvedValue(mocks.actor)
  mocks.requirePermission.mockImplementation(() => {
    if (!mocks.canWrite) throw new Error('Forbidden: catalog.write')
  })
  mocks.upload.mockResolvedValue({ ok: true, id: 'media-a', status: 'pending' })
  mocks.register.mockResolvedValue({ ok: true, id: 'media-a', status: 'pending' })
  mocks.signRead.mockResolvedValue({ data: { signedUrl: 'https://synthetic.example.test/signed-image' }, error: null })
  mocks.storageFrom.mockReturnValue({ createSignedUrl: mocks.signRead })
  mocks.callVision.mockResolvedValue({ data: null, rawText: 'synthetic no extraction' })
})

function expectNoStorageOrAi() {
  expect(mocks.storageAccess).not.toHaveBeenCalled()
  expect(mocks.storageFrom).not.toHaveBeenCalled()
  expect(mocks.callVision).not.toHaveBeenCalled()
}

describe('barcode product image upload workflow', () => {
  it('looks up the barcode in the caller organization and delegates FormData bytes to the secure media service', async () => {
    const form = imageForm()
    await expect(invoke(uploadProductImageByBarcode, form)).resolves.toEqual({
      ok: true, media_id: 'media-a', product_id: products[0].id, product_name: 'منتج اصطناعي', status: 'pending',
    })
    expect(context.supabase.from).toHaveBeenCalledWith('catalog_products')
    expect(filters).toEqual([['barcode', '6221234567890'], ['organization_id', 'org-a']])
    expect(mocks.getActor).toHaveBeenCalledWith(context.supabase, context.userId)
    expect(mocks.requirePermission).toHaveBeenCalledWith(mocks.actor, 'catalog.write')
    expect(mocks.upload).toHaveBeenCalledWith(context, { productId: products[0].id, kind: 'primary', file: form.get('file') })
    expectNoStorageOrAi()
  })

  it.each([0, 2])('does not upload when barcode resolves to %s products', async (count) => {
    products = count === 0 ? [] : [products[0], { id: 'another-product', name_ar: 'منتج مكرر' }]
    await expect(invoke(uploadProductImageByBarcode, imageForm())).resolves.toMatchObject({ ok: false, error: expect.any(String) })
    expect(mocks.upload).not.toHaveBeenCalled()
    expectNoStorageOrAi()
  })

  it('rejects a missing barcode during validation before database or media operations', async () => {
    const form = imageForm()
    form.delete('barcode')
    await expect(invoke(uploadProductImageByBarcode, form)).rejects.toThrow()
    expect(context.supabase.from).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
    expectNoStorageOrAi()
  })

  it('allows an organization catalog writer without requiring a global administrative role', async () => {
    isAdmin = false
    await expect(invoke(uploadProductImageByBarcode, imageForm())).resolves.toMatchObject({ ok: true, status: 'pending' })
    expect(context.supabase.rpc).not.toHaveBeenCalled()
    expect(mocks.upload).toHaveBeenCalledTimes(1)
    expectNoStorageOrAi()
  })

  it('also requires catalog.write before querying a barcode', async () => {
    mocks.canWrite = false
    await expect(invoke(uploadProductImageByBarcode, imageForm())).rejects.toThrow('catalog.write')
    expect(context.supabase.from).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
    expectNoStorageOrAi()
  })

  it('reports catalog lookup errors without attempting an upload', async () => {
    queryError = { message: 'synthetic lookup failure' }
    await expect(invoke(uploadProductImageByBarcode, imageForm())).rejects.toThrow('synthetic lookup failure')
    expect(mocks.upload).not.toHaveBeenCalled()
    expectNoStorageOrAi()
  })

  it('reports the secure service upload failure instead of returning a successful link', async () => {
    mocks.upload.mockRejectedValue(new Error('synthetic secure upload denial'))
    await expect(invoke(uploadProductImageByBarcode, imageForm())).rejects.toThrow('synthetic secure upload denial')
    expectNoStorageOrAi()
  })
})

describe('existing media link compatibility', () => {
  it('delegates canonical existing product references to secure registration and retains pending status', async () => {
    const path = `${products[0].id}/existing.png`
    await expect(invoke(linkMediaByBarcode, { barcode: '6221234567890', storagePath: path, kind: 'gallery' })).resolves.toMatchObject({ ok: true, media_id: 'media-a', status: 'pending' })
    expect(filters).toEqual([['barcode', '6221234567890'], ['organization_id', 'org-a']])
    expect(mocks.register).toHaveBeenCalledWith(context, { productId: products[0].id, storagePath: path, kind: 'gallery' })
    expect(mocks.upload).not.toHaveBeenCalled()
    expectNoStorageOrAi()
  })

  it('refuses the legacy unchecked signed upload route for product images', async () => {
    await expect(invoke(createVisionUploadUrl, { bucket: 'product-images', filename: 'image.png' })).rejects.toThrow('الرفع الآمن')
    expectNoStorageOrAi()
    expect(mocks.upload).not.toHaveBeenCalled()
  })
})

describe('private OCR object caller scope', () => {
  it('allows the caller own canonical prescription image to reach signing and OCR', async () => {
    const path = `${mocks.actor.userId}/prescription.png`
    await expect(invoke(analyzePrescriptionImage, { storagePath: path })).resolves.toMatchObject({ ok: false })
    expect(mocks.storageFrom).toHaveBeenCalledWith('prescriptions')
    expect(mocks.signRead).toHaveBeenCalledWith(path, 5 * 60)
    expect(mocks.callVision).toHaveBeenCalledTimes(1)
  })

  it.each([
    { fn: analyzePrescriptionImage, path: 'another-caller/prescription.png' },
    { fn: analyzeInvoiceImage, path: 'another-caller/invoice.png' },
    { fn: analyzePrescriptionImage, path: `${mocks.actor.userId}/../another-caller/private.png` },
    { fn: analyzeInvoiceImage, path: `${mocks.actor.userId}/%2e%2e%2fprivate.png` },
  ])('rejects another caller or ambiguous object path before Storage and AI: $path', async ({ fn, path }) => {
    await expect(invoke(fn, { storagePath: path })).rejects.toThrow()
    expectNoStorageOrAi()
  })
})
