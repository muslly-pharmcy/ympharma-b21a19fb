import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSelectedAdminClient, supabaseAdmin } from '@/lib/backend/admin.server'
import { PUBLIC_BACKEND } from '../config/public-backend'

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

function storageRequests() {
  const requests: Request[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(new Request(input, init))
    return new Response('[]', { headers: { 'content-type': 'application/json' } })
  }))
  return requests
}

describe('server-only selected-project client', () => {
  it('sends an opaque secret only as apikey to the selected API, with a bounded readiness request', async () => {
    const requests = storageRequests()
    await createSelectedAdminClient('sb_secret_synthetic_only', 5000).storage.listBuckets()
    expect(requests).toHaveLength(1)
    expect(requests[0].url).toBe(`${PUBLIC_BACKEND.url}/storage/v1/bucket`)
    expect(requests[0].headers.get('apikey')).toBe('sb_secret_synthetic_only')
    expect(requests[0].headers.has('authorization')).toBe(false)
    expect(requests[0].signal.aborted).toBe(false)
  })
  it('retains legacy JWT authorization required by legacy service-role keys', async () => {
    const requests = storageRequests()
    const key = 'header.synthetic_service_role.signature'
    await createSelectedAdminClient(key).storage.listBuckets()
    expect(requests[0].headers.get('authorization')).toBe(`Bearer ${key}`)
    expect(requests[0].headers.get('apikey')).toBe(key)
  })
  it('rebuilds on rotation and immediately disables privileged access after removal', async () => {
    const requests = storageRequests()
    vi.stubEnv('MUSLLY_SUPABASE_PROJECT_ID', PUBLIC_BACKEND.projectId)
    vi.stubEnv('MUSLLY_SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_synthetic_one')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    await supabaseAdmin.storage.listBuckets()
    vi.stubEnv('MUSLLY_SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_synthetic_two')
    await supabaseAdmin.storage.listBuckets()
    expect(requests.map((request) => request.headers.get('apikey'))).toEqual([
      'sb_secret_synthetic_one', 'sb_secret_synthetic_two',
    ])
    vi.stubEnv('MUSLLY_SUPABASE_SERVICE_ROLE_KEY', '')
    expect(() => supabaseAdmin.storage).toThrow('privileged operations are disabled')
    expect(requests).toHaveLength(2)
  })
})
