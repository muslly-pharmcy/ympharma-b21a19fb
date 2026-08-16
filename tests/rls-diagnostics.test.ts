import { describe, expect, it } from 'vitest'
import { didRlsProbePass } from '@/lib/admin/rls-diagnostics'

const ok = (count: number | null) => ({ count, error: null })
const denied = { count: null, error: { message: 'permission denied' } }

describe('RLS diagnostics verdict', () => {
  it('accepts a readable public projection', () => {
    expect(didRlsProbePass('anon-readable', ok(10), ok(10))).toBe(true)
  })

  it('rejects a failed public projection', () => {
    expect(didRlsProbePass('anon-readable', denied, ok(10))).toBe(false)
  })

  it('accepts both empty RLS results and explicit denial for private tables', () => {
    expect(didRlsProbePass('anon-hidden', ok(0), ok(3))).toBe(true)
    expect(didRlsProbePass('anon-hidden', denied, ok(3))).toBe(true)
  })

  it('rejects rows visible anonymously or an authenticated probe failure', () => {
    expect(didRlsProbePass('anon-hidden', ok(1), ok(3))).toBe(false)
    expect(didRlsProbePass('anon-hidden', ok(0), denied)).toBe(false)
  })
})
