import { describe, it, expect, beforeEach } from 'vitest'
import {
  guardPublicRequest,
  __resetPublicGuardForTests,
} from '../src/lib/security/public-endpoint-guard.server'

function req(init: {
  method?: string
  contentType?: string
  body?: string
  ip?: string
  contentLength?: number
} = {}): Request {
  const headers = new Headers()
  if (init.contentType) headers.set('content-type', init.contentType)
  if (init.ip) headers.set('cf-connecting-ip', init.ip)
  if (init.contentLength !== undefined) {
    headers.set('content-length', String(init.contentLength))
  }
  const method = init.method ?? 'POST'
  const hasBody = method !== 'GET' && method !== 'HEAD'
  return new Request('https://example.test/api/public/x', {
    method,
    headers,
    body: hasBody ? (init.body ?? '') : undefined,
  })
}

describe('guardPublicRequest', () => {
  beforeEach(() => __resetPublicGuardForTests())

  it('accepts a well-formed request and returns a correlation id', async () => {
    const res = await guardPublicRequest(
      req({ contentType: 'application/json', body: '{"a":1}', ip: '1.1.1.1' }),
      { route: 'test' },
    )
    if (res instanceof Response) throw new Error('expected accept')
    expect(res.correlationId).toMatch(/^pub_/)
    expect(res.body).toBe('{"a":1}')
    expect(res.ipHash).not.toContain('1.1.1.1')
  })

  it('rejects wrong method with 405', async () => {
    const res = await guardPublicRequest(req({ method: 'GET' }), {
      route: 'test',
    })
    expect(res).toBeInstanceOf(Response)
    expect((res as Response).status).toBe(405)
  })

  it('rejects unsupported content-type with 415', async () => {
    const res = await guardPublicRequest(
      req({ contentType: 'text/plain', body: 'hi' }),
      { route: 'test' },
    )
    expect((res as Response).status).toBe(415)
  })

  it('rejects oversized declared body with 413', async () => {
    const res = await guardPublicRequest(
      req({
        contentType: 'application/json',
        contentLength: 1024 * 1024,
        body: '{}',
      }),
      { route: 'test', maxBytes: 1024 },
    )
    expect((res as Response).status).toBe(413)
  })

  it('rate-limits after exceeding max in window', async () => {
    const opts = {
      route: 'rl',
      rateLimit: { windowMs: 60_000, max: 2 },
    }
    const mk = () =>
      guardPublicRequest(
        req({ contentType: 'application/json', body: '{}', ip: '9.9.9.9' }),
        opts,
      )
    expect(await mk()).not.toBeInstanceOf(Response)
    expect(await mk()).not.toBeInstanceOf(Response)
    const third = await mk()
    expect(third).toBeInstanceOf(Response)
    expect((third as Response).status).toBe(429)
    expect((third as Response).headers.get('retry-after')).toBeTruthy()
  })
})
