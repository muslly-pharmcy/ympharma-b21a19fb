import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('inventory/catalog legacy write barriers', () => {
  it('never adjusts batch quantity via the unscoped absolute stock setter', () => {
    const handler = read('src/lib/store-admin.functions.ts')
    const block = handler.split('export const setProductStockBalance =')[1]?.split('// ---------- List for admin inventory table ----------')[0] ?? ''
    expect(block).toContain("requirePermission(actor, 'inventory.write')")
    expect(block).toContain('throw new Error(')
    expect(block).not.toMatch(/from\(['"]inv_stock_batches['"]\)/)
    expect(block).not.toContain('supabaseAdmin')
  })
  it('does not expose a editable stock balance or create stock via the store admin UI', () => {
    const ui = read('src/routes/_authenticated/admin-inventory.tsx')
    expect(ui).not.toContain('setProductStockBalance')
    expect(ui).not.toContain('onSaveStock')
    expect(ui).not.toContain('admin initial stock')
  })
  it('stages catalog review without public approval, privileged defaults, or stock movement', () => {
    const importer = read('src/lib/excel-import.functions.ts')
    expect(importer).toContain("requirePermission(actor, 'catalog.write')")
    expect(importer).toContain("eq('organization_id', actor.organizationId)")
    expect(importer).toContain('toPendingReviewProduct(')
    expect(importer).not.toContain('DEFAULT_ORG')
    expect(importer).not.toContain('DEFAULT_WH')
    expect(importer).not.toMatch(/from\(['"]inv_stock_batches['"]\)/)
    expect(importer).not.toContain('sbdma_official_price')
  })
})
