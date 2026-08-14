import { describe, it, expect } from 'vitest'
import { sanitizeFilterTerm, ilikeContains } from '@/lib/security/postgrest-filter'

describe('PostgREST filter sanitisation', () => {
  it('strips expression separators that could widen an or() filter', () => {
    const malicious = 'x,id.gte.0'
    const term = sanitizeFilterTerm(malicious)
    expect(term).not.toContain(',')
    expect(term).not.toContain('.')
    expect(term).toBe('x id gte 0')
  })

  it('strips parentheses, quotes, wildcards and control characters', () => {
    expect(sanitizeFilterTerm(`a)or(b."c'%*\u0007`)).toBe('a or b c')
  })

  it('preserves ordinary Arabic and Latin search terms', () => {
    expect(sanitizeFilterTerm('محمد علي')).toBe('محمد علي')
    expect(sanitizeFilterTerm('  Ahmed   Saleh ')).toBe('Ahmed Saleh')
  })

  it('caps length', () => {
    expect(sanitizeFilterTerm('a'.repeat(200)).length).toBe(80)
  })

  it('builds a single safe ilike clause', () => {
    const clause = ilikeContains('full_name', 'x,id.gte.0')
    expect(clause).toBe('full_name.ilike.%x id gte 0%')
    // Exactly one comma-free value segment → cannot introduce a second filter.
    expect(clause.split(',')).toHaveLength(1)
  })
})
