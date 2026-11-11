import { describe, expect, it } from 'vitest'
import { normalizeArabic, parseCsv, reviewMedicineRows } from '../scripts/catalog/review-medicine-import.mjs'

function validRow(overrides = {}) {
  return {
    trade_name: 'Paracetamol 500 mg',
    scientific_name: 'Paracetamol',
    barcode: '1234567890123',
    manufacturer: 'Sample Manufacturer',
    pack_unit: 'box',
    conversion_factor: 10,
    currency: 'YER',
    purchase_price: 100,
    selling_price: 150,
    requires_prescription: false,
    controlled: false,
    ...overrides,
  }
}
describe('review-only medicine import gate', () => {
  it('normalizes Arabic letter variants for duplicate detection', () => {
    expect(normalizeArabic('إبرة')).toBe(normalizeArabic('ابره'))
  })
  it('rejects zero or negative unit conversion', () => {
    const r = reviewMedicineRows([validRow({ conversion_factor: 0 })])
    expect(r.summary.blocked).toBe(1)
    expect(r.summary.invalid_factors).toBe(1)
  })
  it('blocks duplicate barcodes and requires manual identity review', () => {
    const r = reviewMedicineRows([validRow(), validRow()])
    expect(r.summary.duplicate_barcodes).toBe(2)
    expect(r.summary.duplicate_identities).toBe(2)
    expect(r.safe_to_import_automatically).toBe(false)
  })
  it('does not silently invent barcode, medical flags, prices or currency', () => {
    const r = reviewMedicineRows([validRow({
      barcode: '', requires_prescription: '', controlled: '', currency: '',
      selling_price: '',
    })])
    const codes = r.rows[0].findings.map(x => x.code)
    expect(codes).toContain('MISSING_BARCODE')
    expect(codes).toContain('PRESCRIPTION_FLAG_UNVERIFIED')
    expect(codes).toContain('CONTROLLED_FLAG_UNVERIFIED')
    expect(codes).toContain('MISSING_CURRENCY')
    expect(codes).toContain('MISSING_SELLING_PRICE')
  })
  it('never imports automatically, even when structurally complete', () => {
    const r = reviewMedicineRows([validRow()])
    expect(r.summary.blocked).toBe(0)
    expect(r.summary.needs_review).toBe(0)
    expect(r.safe_to_import_automatically).toBe(false)
  })
  it('supports Arabic-digit positive prices and review on unsupported currencies', () => {
    const r = reviewMedicineRows([validRow({ purchase_price: '١٠٠', currency: 'EUR' })])
    expect(r.rows[0].findings.map(x => x.code)).toContain('UNKNOWN_CURRENCY')
  })
  it('parses semicolon CSV with quoted newlines and quoted delimiters', () => {
    const r = parseCsv('name_ar;barcode\n"اسم; تجاري";12345678\n"دواء\nآخر";87654321\n')
    expect(r).toHaveLength(2)
    expect(r[0].name_ar).toBe('اسم; تجاري')
    expect(r[1].name_ar).toContain('آخر')
  })
})
