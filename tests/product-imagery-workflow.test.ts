import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CatalogMediaContext } from '@/lib/catalog-media-service.server'

const mocks = vi.hoisted(() => ({
  actor: vi.fn(), permission: vi.fn(), upload: vi.fn(), record: vi.fn(), adminStorage: vi.fn(),
}))
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    let validate = (raw: unknown): unknown => raw
    const chain = {
      middleware: () => chain,
      validator: (fn: typeof validate) => { validate = fn; return chain },
      handler: (stub: (args: unknown) => Promise<unknown>, original?: (args: { data: unknown; context: unknown }) => Promise<unknown>) => {
        const fn = original ?? stub
        const execute = (args: { data: unknown; context: unknown }) => fn({ ...args, data: validate(args.data) })
        return Object.assign(execute, { __executeServer: execute })
      },
    }
    return chain
  },
}))
vi.mock('@tanstack/react-start/server-rpc', () => ({ createServerRpc: (_meta: unknown, fn: unknown) => fn }))
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }))
vi.mock('@/lib/session.server', () => ({ getActorFromSupabase: mocks.actor, requirePermission: mocks.permission }))
vi.mock('@/lib/catalog-media-service.server', () => ({ uploadCatalogImage: mocks.upload }))
vi.mock('@/lib/ai/observability.server', () => ({ recordAiCall: mocks.record }))
vi.mock('@/lib/ai/error-classify', () => ({ classifyAiFailure: () => 'synthetic-failure' }))
vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: { get storage() { mocks.adminStorage(); throw new Error('Unexpected direct privileged storage') } },
}))

import { generateProductImages_createServerFn_handler as generateProductImages } from '@/lib/ai/product-imagery.functions?tss-serverfn-split'

const ownId = '11111111-1111-4111-8111-111111111111'
const otherId = '22222222-2222-4222-8222-222222222222'
const orgId = '33333333-3333-4333-8333-333333333333'
const actor = { userId: '44444444-4444-4444-8444-444444444444', organizationId: orgId, orgRole: 'owner', roles: [] }
const fixtures = [
  { id: ownId, organization_id: orgId, name_ar: 'منتج اصطناعي', name_en: null, brand: null, dosage_form: null, is_public: true, status: 'approved' },
  { id: otherId, organization_id: 'other-org', name_ar: 'منتج آخر', name_en: null, brand: null, dosage_form: null, is_public: true, status: 'approved' },
]
let context: CatalogMediaContext
let hasAdminPermission: boolean
let hasUpload: boolean
let mediaError: { message: string } | null
let productFilters: Record<string, unknown>[]
let fetchMock: ReturnType<typeof vi.fn>
const run = generateProductImages as unknown as (args: { data: unknown; context: CatalogMediaContext }) => Promise<{
  generated: number; skipped: number; results: { productId: string; ok: boolean; reason?: string; status?: string }[]
}>

beforeEach(() => {
  vi.resetAllMocks()
  hasAdminPermission = true
  hasUpload = true
  mediaError = null
  productFilters = []
  mocks.actor.mockResolvedValue(actor)
  mocks.permission.mockImplementation((_actor, permission) => {
    if (permission === 'system.admin' && !hasAdminPermission) throw new Error('صلاحيات المشرف مطلوبة')
  })
  mocks.upload.mockResolvedValue({ ok: true, id: 'synthetic-media', status: 'pending' })
  mocks.record.mockResolvedValue(undefined)
  vi.stubEnv('LOVABLE_API_KEY', 'synthetic-test-key')
  const png = [137, 80, 78, 71, 13, 10, 26, 10]
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [{ b64_json: btoa(String.fromCharCode(...png)) }] }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)

  const from = vi.fn((table: string) => {
    const filters: Record<string, unknown> = {}
    let ids: string[] | null = null
    const query = {
      select: () => query,
      eq: (name: string, value: unknown) => { filters[name] = value; return query },
      in: (name: string, values: string[]) => { if (name === 'id') ids = values; return query },
      limit: () => query,
      then: (resolve: (result: unknown) => unknown) => {
        if (table === 'catalog_products') {
          productFilters.push(filters)
          const data = fixtures.filter((product) => Object.entries(filters).every(([key, value]) => product[key as keyof typeof product] === value)
            && (!ids || ids.includes(product.id)))
          return Promise.resolve({ data, error: null }).then(resolve)
        }
        if (table === 'catalog_product_media') return Promise.resolve({ count: 0, error: mediaError }).then(resolve)
        throw new Error(`Unexpected synthetic table ${table}`)
      },
    }
    return query
  })
  context = {
    userId: actor.userId,
    supabase: { from, rpc: vi.fn(async () => ({ data: hasUpload, error: null })) } as unknown as CatalogMediaContext['supabase'],
  }
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('AI image writer delegates secure catalog storage', () => {
  it('keeps a system-admin permission gate and blocks before billable work', async () => {
    hasAdminPermission = false
    await expect(run({ data: {}, context })).rejects.toThrow('صلاحيات المشرف')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('requires caller-scoped catalog write and database upload permission before generation', async () => {
    hasUpload = false
    await expect(run({ data: {}, context })).rejects.toThrow('صلاحية رفع')
    expect(mocks.actor).toHaveBeenCalledWith(context.supabase, context.userId)
    expect(mocks.permission).toHaveBeenCalledWith(actor, 'catalog.write')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('does not generate or upload a different organization product requested explicitly', async () => {
    const result = await run({ data: { productIds: [otherId] }, context })
    expect(result.results).toEqual([{ productId: otherId, ok: false, reason: 'product_not_owned_or_unavailable' }])
    expect(productFilters[0]).toMatchObject({ organization_id: orgId, is_public: true, status: 'approved' })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('passes generated bytes through the shared upload with the original caller and review status', async () => {
    const result = await run({ data: { productIds: [ownId] }, context })
    expect(result).toEqual({ generated: 1, skipped: 0, results: [{ productId: ownId, ok: true, status: 'pending' }] })
    expect(mocks.upload).toHaveBeenCalledWith(context, expect.objectContaining({ productId: ownId, kind: 'primary', file: expect.any(Blob) }))
    expect(mocks.upload.mock.calls[0][1].file.type).toBe('image/png')
    expect(mocks.adminStorage).not.toHaveBeenCalled()
    expect(context.supabase.from).not.toHaveBeenCalledWith('user_roles')
  })

  it('reports secure upload validation errors without claiming success', async () => {
    mocks.upload.mockRejectedValue(new Error('synthetic invalid image'))
    const result = await run({ data: { productIds: [ownId] }, context })
    expect(result.results).toEqual([{ productId: ownId, ok: false, reason: 'synthetic invalid image' }])
    expect(result.generated).toBe(0)
    expect(mocks.adminStorage).not.toHaveBeenCalled()
  })

  it('does not generate when the media existence query fails', async () => {
    mediaError = { message: 'synthetic database error' }
    const result = await run({ data: {}, context })
    expect(result.results[0]).toMatchObject({ productId: ownId, ok: false, reason: mediaError.message })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
  })
})
