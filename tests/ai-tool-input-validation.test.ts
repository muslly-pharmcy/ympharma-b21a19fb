import { describe, expect, it } from 'vitest'
import { ToolInputValidationError, validateToolInput } from '../src/lib/ai/runtime/tool-registry.server'

describe('AI tool input boundary', () => {
  it('normalizes bounded numeric inputs before execution', () => {
    expect(validateToolInput('list_expiring_soon', { days: '30' })).toEqual({ days: 30 })
  })

  it('rejects undeclared fields rather than passing them to the executor', () => {
    expect(() => validateToolInput('ops_snapshot', { organization_id: 'other-org' })).toThrow(
      ToolInputValidationError,
    )
  })

  it('requires a concrete search discriminator', () => {
    expect(() => validateToolInput('search_products', {})).toThrow(ToolInputValidationError)
  })

  it('rejects invalid resource identifiers', () => {
    expect(() => validateToolInput('get_product_stock', { product_id: 'not-a-uuid' })).toThrow(
      ToolInputValidationError,
    )
  })
})
