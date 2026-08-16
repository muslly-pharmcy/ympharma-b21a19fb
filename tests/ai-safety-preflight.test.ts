import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/lib/ai/runtime/policy-engine.server', () => ({
  evaluatePolicy: vi.fn(async () => ({ allowed: true })),
}))

describe('AI safety preflight', () => {
  it('redacts direct identifiers before the AI runtime receives the prompt', async () => {
    const { preflight } = await import('../src/lib/ai/runtime/safety-layer.server')
    const result = await preflight(
      { userId: '00000000-0000-4000-8000-000000000001' } as never,
      { purpose: 'invoke' } as never,
      'Contact patient@example.com on +1-555-123-4567.',
    )

    expect(result.ok).toBe(true)
    expect(result.redactedInput).not.toContain('patient@example.com')
    expect(result.redactedInput).not.toContain('+1-555-123-4567')
  })
})
