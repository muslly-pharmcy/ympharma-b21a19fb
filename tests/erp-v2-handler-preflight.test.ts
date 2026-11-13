import { afterEach, describe, expect, it } from 'vitest'
import { erpV2Handle } from '@/lib/erp/v2-handler.server'
import { signErpV2 } from '@/lib/erp/v2-signature'

const PATH = '/api/public/erp/v2/stock'
const ORG = '11111111-1111-4111-8111-111111111111'
const SECRET = 'synthetic-only-secret-12345678901234567890'
const envBefore = {
  enabled: process.env['ERP_SYNC_V2_ENABLED'],
  org: process.env['ERP_SYNC_V2_ORG_ID'],
  secret: process.env['ERP_SYNC_V2_HMAC_SECRET'],
}

function configure() {
  process.env['ERP_SYNC_V2_ENABLED'] = 'true'
  process.env['ERP_SYNC_V2_ORG_ID'] = ORG
  process.env['ERP_SYNC_V2_HMAC_SECRET'] = SECRET
}

afterEach(() => {
  for (const [name, original] of [
    ['ERP_SYNC_V2_ENABLED', envBefore.enabled],
    ['ERP_SYNC_V2_ORG_ID', envBefore.org],
    ['ERP_SYNC_V2_HMAC_SECRET', envBefore.secret],
  ] as const) {
    if (original === undefined) delete process.env[name]
    else process.env[name] = original
  }
})

function request(
  options: { org?: string; signature?: string; idempotencyKey?: string; target?: string; body?: string } = {},
) {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const organizationId = options.org ?? ORG
  const idempotencyKey = options.idempotencyKey ?? 'unit-test-key-00001'
  const body = options.body ?? '{"sourceSystem":"unit","rows":[]}'
  const target = options.target ?? PATH
  const signature = options.signature ?? signErpV2(SECRET, {
    timestamp, method: 'POST', target,
    organizationId, idempotencyKey, body,
  })
  return new Request('https://unit.test' + target, {
    method: 'POST',
    body,
    headers: {
      'x-erp-organization-id': organizationId,
      'x-erp-timestamp': timestamp,
      'x-erp-signature': signature,
      'idempotency-key': idempotencyKey,
    },
  })
}

describe('ERP v2 server-side preflight', () => {
  const mustNotRun = async (): Promise<never> => { throw Error('DB callback must not run') }
  it('keeps the entire integration disabled by default', async () => {
    delete process.env['ERP_SYNC_V2_ENABLED']
    const response = await erpV2Handle(request(), PATH, mustNotRun)
    expect(response.status).toBe(503)
  })
  it('rejects a request for another organization before connecting', async () => {
    configure()
    const response = await erpV2Handle(request({
      org: '22222222-2222-4222-8222-222222222222',
    }), PATH, mustNotRun)
    expect(response.status).toBe(403)
  })
  it('rejects invalid signatures before loading the database', async () => {
    configure()
    const response = await erpV2Handle(request({ signature: '0'.repeat(64) }), PATH, mustNotRun)
    expect(response.status).toBe(401)
  })
  it('does not allow query parameters on signed stock mutations', async () => {
    configure()
    const response = await erpV2Handle(request({ target: PATH + '?skipValidation=true' }), PATH, mustNotRun)
    expect(response.status).toBe(400)
  })
  it('rejects short idempotency keys', async () => {
    configure()
    const response = await erpV2Handle(request({ idempotencyKey: 'short' }), PATH, mustNotRun)
    expect(response.status).toBe(400)
  })
  it('rejects HMAC signing config shorter than 32 characters', async () => {
    configure()
    process.env['ERP_SYNC_V2_HMAC_SECRET'] = 'short'
    const response = await erpV2Handle(request(), PATH, mustNotRun)
    expect(response.status).toBe(503)
  })
})
