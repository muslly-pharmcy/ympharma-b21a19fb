import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AsyncLocalStorage } from 'node:async_hooks'

const context = vi.hoisted(() => ({ scope: null as AsyncLocalStorage<Headers> | null }))
vi.mock('@tanstack/react-start/server', async () => {
  const { AsyncLocalStorage } = await import('node:async_hooks')
  const scope = new AsyncLocalStorage<Headers>()
  context.scope = scope
  return {
    getRequestHeader: (name: string) => scope.getStore()?.get(name) ?? undefined,
    getRequest: () => new Request('https://app.example.test/rpc', { headers: scope.getStore() }),
  }
})
vi.mock('@/integrations/supabase/public-config', () => ({
  getPublicSupabaseConfig: () => ({
    url: 'https://caller-scope.example.test',
    publishableKey: 'sb_publishable_synthetic',
  }),
}))

import { getActor, UnauthorizedError, requireOrg, hasPermission } from '@/lib/session.server'
import { createCallerSupabaseClient } from '@/lib/supabase-user.server'

const tokenA = `header.${btoa(JSON.stringify({ sub: 'untrusted-claim' }))}.signature-a`
const tokenB = `header.${btoa(JSON.stringify({ sub: 'caller-b' }))}.signature-b`
const invalidToken = 'header.invalid.signature'
type Call = { path: string; token: string; userFilter: string | null; apiKey: string | null }
let calls: Call[]
let membershipDenied = false

function asCaller(token: string | null, ip = '192.0.2.1') {
  const headers = new Headers({ 'x-forwarded-for': ip, 'user-agent': 'synthetic-session-test' })
  if (token) headers.set('authorization', `Bearer ${token}`)
  return context.scope!.run(headers, () => getActor())
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

beforeEach(() => {
  calls = []
  membershipDenied = false
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? ''
    const userId = token === tokenA ? 'caller-a' : token === tokenB ? 'caller-b' : null
    calls.push({ path: url.pathname, token, userFilter: url.searchParams.get('user_id'), apiKey: request.headers.get('apikey') })
    if (url.pathname === '/auth/v1/user') {
      if (!userId) return json({ message: 'Synthetic invalid token', code: 'bad_jwt' }, 401)
      return json({ id: userId, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' })
    }
    if (!userId || url.searchParams.get('user_id') !== `eq.${userId}`) {
      return json({ message: 'Synthetic caller isolation violation', code: '42501' }, 403)
    }
    if (url.pathname === '/rest/v1/organization_members') {
      if (membershipDenied) return json([])
      return json([{ organization_id: `org-${userId}`, role: 'viewer', branch_scope: [`branch-${userId}`] }])
    }
    if (url.pathname === '/rest/v1/user_roles') return json([{ role: 'staff' }])
    throw new Error(`Unexpected synthetic request path: ${url.pathname}`)
  }))
})

afterEach(() => vi.unstubAllGlobals())

describe('caller-scoped actor resolution', () => {
  it('isolates simultaneous callers and trusts verified Auth user IDs over decoded claims', async () => {
    const [a, b] = await Promise.all([asCaller(tokenA, '192.0.2.1'), asCaller(tokenB, '192.0.2.2')])
    expect(a).toMatchObject({ userId: 'caller-a', organizationId: 'org-caller-a', branchId: 'branch-caller-a', roles: ['staff'], orgRole: 'viewer', ip: '192.0.2.1' })
    expect(b).toMatchObject({ userId: 'caller-b', organizationId: 'org-caller-b', branchId: 'branch-caller-b', roles: ['staff'], orgRole: 'viewer', ip: '192.0.2.2' })
    for (const call of calls.filter((call) => call.path.startsWith('/rest/'))) {
      expect(call.userFilter).toBe(call.token === tokenA ? 'eq.caller-a' : 'eq.caller-b')
      expect(call.apiKey).toBe('sb_publishable_synthetic')
    }
    expect(calls.filter((call) => call.path.startsWith('/rest/'))).toHaveLength(4)
    expect(hasPermission(a, 'catalog.read')).toBe(true)
    expect(hasPermission(a, 'system.admin')).toBe(false)
    expect(() => requireOrg(a, b.organizationId)).toThrow(UnauthorizedError)
  })

  it('rejects Auth-server token failures before reading roles or membership', async () => {
    await expect(asCaller(invalidToken)).rejects.toThrow('Invalid session')
    expect(calls.map((call) => call.path)).toEqual(['/auth/v1/user'])
  })

  it('rejects missing bearer tokens without making any backend request', async () => {
    await expect(asCaller(null)).rejects.toThrow('Missing bearer token')
    expect(calls).toEqual([])
  })

  it('does not invent membership when the caller has no active organization', async () => {
    membershipDenied = true
    await expect(asCaller(tokenA)).rejects.toThrow('no active organization membership')
  })

  it('never reuses a caller client between requests', () => {
    expect(createCallerSupabaseClient(tokenA)).not.toBe(createCallerSupabaseClient(tokenB))
  })
})
