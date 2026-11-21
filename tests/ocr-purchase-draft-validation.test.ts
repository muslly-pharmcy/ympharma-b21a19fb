import { describe, expect, it } from 'vitest'
import { validateOcrPurchaseDraft, type OcrPurchaseRow } from '@/lib/ocr-purchase-draft-validation'

const productId = '11111111-1111-4111-8111-111111111111'
const row = (payload: Record<string, unknown>, decision = 'matched'): OcrPurchaseRow => ({
  row_index: 0, decision, matched_product_id: productId, payload,
})

describe('OCR purchase-order draft safety', () => {
  it('does not invent a quantity when extraction is missing', () => {
    const result = validateOcrPurchaseDraft([row({ _quantity: null, _unit_cost: 150 })])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]?.reason).toContain('الكمية')
  })

  it('does not invent a zero cost or accept unreviewed free items', () => {
    for (const value of [null, 0, -2, Number.NaN]) {
      const result = validateOcrPurchaseDraft([row({ _quantity: 2, _unit_cost: value })])
      expect(result.ok).toBe(false)
    }
  })

  it('computes exact decimal totals without JS floating-point rounding', () => {
    const result = validateOcrPurchaseDraft([
      row({ _quantity: 0.1, _unit_cost: 0.2 }),
      { ...row({ _quantity: 0.2, _unit_cost: 0.2 }), row_index: 1 },
    ])
    expect(result).toMatchObject({ ok: true, totalAmount: '0.0600', skipped: 0 })
  })

  it('skips unmatched items, but fails if a matched item is unsafe', () => {
    const result = validateOcrPurchaseDraft([
      row({ _quantity: 2, _unit_cost: 15 }),
      { ...row({ _quantity: null, _unit_cost: 15 }), row_index: 1 },
      { ...row({}, 'ambiguous'), row_index: 2 },
    ])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors).toHaveLength(1)
  })

  it('rejects invalid decimals, invalid dates and invalid product IDs', () => {
    expect(validateOcrPurchaseDraft([row({ _quantity: '1.1234', _unit_cost: 2 })]).ok).toBe(false)
    expect(validateOcrPurchaseDraft([row({ _quantity: 1, _unit_cost: '2.12345' })]).ok).toBe(false)
    expect(validateOcrPurchaseDraft([row({ _quantity: 1, _unit_cost: 2, _expiry_date: '2026-02-30' })]).ok).toBe(false)
    expect(validateOcrPurchaseDraft([{ ...row({ _quantity: 1, _unit_cost: 2 }), matched_product_id: 'other-tenant' }]).ok).toBe(false)
  })

  it('accepts explicitly extracted values and retains only draft fields', () => {
    const result = validateOcrPurchaseDraft([row({ _quantity: 1.125, _unit_cost: 5.5, _batch_no: 'LOT-1' })])
    expect(result).toMatchObject({
      ok: true,
      lines: [{ line_no: 1, product_id: productId, qty_ordered: '1.125', unit_cost: '5.5000', batch_no: 'LOT-1' }],
      totalAmount: '6.1875',
      skipped: 0,
    })
  })
})
