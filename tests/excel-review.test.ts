import { describe, it, expect } from 'vitest'
import { toPendingReviewProduct } from '../src/lib/excel-review'

describe('tenant-bound Excel review, never operational import', () => {
  it('keeps proposals nonpublic and clinically unverified', () => {
    const payload = toPendingReviewProduct(
      { store_code: ' X-01 ', name_ar: '  منتج تجريبي ', price: 125.5, qty: 5 },
      'org-unique', 'actor-unique', null,
    )
    expect(payload.organization_id).toBe('org-unique')
    expect(payload.owner_org_id).toBe('org-unique')
    expect(payload.store_code).toBe('X-01')
    expect(payload.name_ar).toBe('منتج تجريبي')
    expect(payload.status).toBe('pending_review')
    expect(payload.is_public).toBe(false)
    expect(payload.requires_prescription).toBe(true)
    expect(payload.metadata.excel_review.inventory_posted).toBe(false)
    expect(payload.metadata.excel_review.proposed_quantity).toBe('5')
    expect(payload.metadata.excel_review.proposed_price_yer).toBe('125.5')
    expect(Object.hasOwn(payload, 'sbdma_official_price')).toBe(false)
    expect(Object.hasOwn(payload, 'qty_on_hand')).toBe(false)
  })
})
