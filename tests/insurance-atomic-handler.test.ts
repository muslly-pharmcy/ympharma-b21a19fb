import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), from: vi.fn(), references: vi.fn(), audit: vi.fn(), legacyIdempotency: vi.fn(),
  actor: { userId: '00000000-0000-4000-8000-000000000001', organizationId: '00000000-0000-4000-8000-000000000002', branchId: null },
}))
vi.mock('@tanstack/react-start', () => ({ createServerFn: () => ({ validator: (parse: (x: unknown) => unknown) => ({ handler: (fn: (x: {data: unknown}) => unknown) => (x: {data: unknown}) => fn({data:parse(x.data)}) }) }) }))
vi.mock('@/lib/session.server', () => ({ getActor: async () => mocks.actor, requireOrg: (_: unknown, org: string) => { if(org !== mocks.actor.organizationId) throw Error('organization denied') }, requirePermission: vi.fn() }))
vi.mock('@/lib/idempotency.server', () => ({ newCorrelationId: () => 'new-correlation', withIdempotency: mocks.legacyIdempotency }))
vi.mock('@/lib/insurance-references.server', () => ({ requireClaimReferences: mocks.references, requireAuthorizationReferences: vi.fn() }))
vi.mock('@/lib/audit.server', () => ({ audit: mocks.audit }))
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: {rpc: mocks.rpc, from:mocks.from} }))
import { createInsuranceClaim } from '@/lib/insurance.mutations.functions'
import { createClaimInput } from '@/domain/insurance/commands'

const input = () => ({ organizationId:mocks.actor.organizationId, patientId:mocks.actor.userId, providerId:mocks.actor.userId, planId:mocks.actor.userId, idempotencyKey:'stable-client-request', items:[{description:'item', quantity:1, unitBilled:0.1, billedAmount:0.1}] })
const invoke = async (data: unknown) => (createInsuranceClaim as unknown as (x: {data:unknown}) => Promise<unknown>)({data})
beforeEach(() => {
  vi.clearAllMocks()
  mocks.rpc.mockResolvedValue({data:{id:'stored-claim',correlationId:'stored-correlation'},error:null})
  mocks.legacyIdempotency.mockImplementation((_key, _actor, _cmd, fn) => fn())
  mocks.from.mockImplementation(() => { throw Error('unexpected non-atomic table request') })
})
describe('atomic insurance claim server boundary', () => {
  it('uses one atomic RPC and returns the durable replay result', async () => {
    await expect(invoke(input())).resolves.toEqual({id:'stored-claim',correlationId:'stored-correlation'})
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.rpc).toHaveBeenCalledWith('insv2_create_claim_atomic', {p_actor_id:mocks.actor.userId,p_branch_id:null,p_request:createClaimInput.parse(input()),p_correlation_id:'new-correlation'})
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.legacyIdempotency).not.toHaveBeenCalled()
    expect(mocks.audit).not.toHaveBeenCalled()
  })
  it('propagates transaction failure without fallback writes', async () => {
    mocks.rpc.mockResolvedValue({data:null,error:{message:'item transaction rolled back'}})
    await expect(invoke(input())).rejects.toThrow('item transaction rolled back')
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.audit).not.toHaveBeenCalled()
  })
  it('requires a client key before any request', async () => {
    await expect(invoke({...input(), idempotencyKey:undefined})).rejects.toThrow()
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.references).not.toHaveBeenCalled()
  })
  it('does not trust supplied actor or branch fields', async () => {
    await invoke({...input(), actorId:'forged', branchId:'forged'})
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({p_actor_id:mocks.actor.userId,p_branch_id:null})
    expect(mocks.rpc.mock.calls[0][1].p_request).not.toHaveProperty('actorId')
  })
  it.each([['unitBilled',0.001],['billedAmount',0.001],['quantity',0.0001],['billedAmount',10000000000],['quantity',1000000000]])('rejects unsupported stored precision/range in %s', async (field,value) => {
    await expect(invoke({...input(),items:[{...input().items[0],[field]:value}]})).rejects.toThrow()
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.references).not.toHaveBeenCalled()
  })
  it('rejects a malformed successful RPC response', async () => {
    mocks.rpc.mockResolvedValue({data:null,error:null})
    await expect(invoke(input())).rejects.toThrow('Invalid atomic claim response')
  })
  it('recovers a durable receipt before looking up optional references removed after commit', async () => {
    mocks.references.mockRejectedValueOnce(new Error('reference no longer exists'))
    await expect(invoke(input())).resolves.toEqual({id:'stored-claim',correlationId:'stored-correlation'})
    expect(mocks.references).not.toHaveBeenCalled()
  })
})
