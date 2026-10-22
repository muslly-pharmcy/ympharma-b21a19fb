import { describe, expect, it } from 'vitest'
import { classifyError } from '../src/lib/errors/classify'

describe('route error display with TanStack unknown errors', () => {
  it.each([null, undefined, 42, 'unexpected failure', { message: 'unexpected failure' }])(
    'provides displayable copy for a non-Error thrown value: %s',
    (error) => {
      const result = classifyError(error)
      expect(typeof result.userMessageAr).toBe('string')
      expect(result.userMessageAr.trim().length).toBeGreaterThan(0)
    },
  )

  it('uses classified UI copy instead of exposing raw backend details', () => {
    const result = classifyError(new Error('private backend detail: synthetic-secret-marker'))
    expect(result.userMessageAr).not.toContain('synthetic-secret-marker')
    expect(result.userMessageAr).not.toContain('private backend detail')
  })

  it('preserves authorization-specific recovery guidance for a thrown response object', () => {
    const result = classifyError({ status: 403, message: 'permission denied' })
    expect(result.kind).toBe('permission')
    expect(result.userMessageAr).not.toBe(classifyError(null).userMessageAr)
  })
})
