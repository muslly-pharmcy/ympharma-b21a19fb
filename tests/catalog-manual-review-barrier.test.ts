import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('manual pharmacy catalog review guard', () => {
  const server = read('src/lib/store-admin.functions.ts')
  const create = server.split('export const createStoreProduct =')[1]?.split('// ---------- Delete product')[0] ?? ''
  const price = server.split('export const updateProductPrice =')[1]?.split('// Compatibility')[0] ?? ''
  const ui = read('src/routes/_authenticated/admin-inventory.tsx')

  it('never auto-approves, publicly exposes, or overwrites the official price on new products', () => {
    expect(create).toContain("status: 'pending_review'")
    expect(create).toContain('is_public: false')
    expect(create).toContain('requires_prescription: true')
    expect(create).toContain('suggested_requires_prescription: data.requires_prescription')
    expect(create).toContain('proposed_price_yer: String(data.price)')
    expect(create).not.toContain('sbdma_official_price: data.price')
    expect(create).not.toContain("status: 'approved'")
  })

  it('disallows official-price writes before clinical catalog approval', () => {
    expect(price).toContain("select('organization_id, sbdma_official_price, status')")
    expect(price).toContain("if (existing.status !== 'approved')")
  })

  it('makes the pending-review status visible and disables the official price editor', () => {
    expect(ui).toContain("disabled={row.status !== 'approved'}")
    expect(ui).toContain('بانتظار الاعتماد')
    expect(ui).toContain('إرسال للمراجعة')
  })
})
