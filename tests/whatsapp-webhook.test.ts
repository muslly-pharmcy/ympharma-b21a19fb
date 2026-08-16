import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { verifySignature, safeEqual, toEventRows } from '@/lib/whatsapp/webhook.server'

const SECRET = 'test-secret'
const sign = (body: string) => `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`

describe('WhatsApp webhook shared handler', () => {
  it('accepts a correctly signed body', () => {
    const body = JSON.stringify({ object: 'whatsapp_business_account' })
    expect(verifySignature(body, sign(body), SECRET)).toBe(true)
  })

  it('rejects tampered bodies, wrong secrets and missing headers', () => {
    const body = JSON.stringify({ a: 1 })
    expect(verifySignature(body + ' ', sign(body), SECRET)).toBe(false)
    expect(verifySignature(body, sign(body), 'other-secret')).toBe(false)
    expect(verifySignature(body, null, SECRET)).toBe(false)
    expect(verifySignature(body, 'deadbeef', SECRET)).toBe(false)
  })

  it('compares verify tokens without leaking on length', () => {
    expect(safeEqual('token', 'token')).toBe(true)
    expect(safeEqual('token', 'tokenx')).toBe(false)
    expect(safeEqual('', '')).toBe(false)
  })

  it('flattens messages and statuses into idempotent rows', () => {
    const rows = toEventRows(
      {
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: 'pn1' },
                  messages: [{ id: 'm1', from: '967700000000' }],
                  statuses: [{ id: 'm1', status: 'delivered', recipient_id: '967700000000' }],
                },
              },
            ],
          },
        ],
      },
      'corr-1',
    )
    expect(rows.map((r) => r['message_id'])).toEqual(['m1', 'm1:delivered'])
    expect(rows.every((r) => r['correlation_id'] === 'corr-1')).toBe(true)
  })

  it('ignores empty envelopes', () => {
    expect(toEventRows({}, 'c')).toEqual([])
  })
})
