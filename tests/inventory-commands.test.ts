import { describe, expect, it } from 'vitest'
import {
  adjustStockInput,
  receiveStockInput,
  reserveStockInput,
  transferStockInput,
} from '@/domain/inventory/commands'
import { createPurchaseOrderInput } from '@/domain/purchasing/commands'

describe('inventory command schemas', () => {
  const org = crypto.randomUUID()
  const wh = crypto.randomUUID()
  const prod = crypto.randomUUID()

  it('receiveStockInput requires positive qty', () => {
    expect(() =>
      receiveStockInput.parse({
        organizationId: org,
        warehouseId: wh,
        productId: prod,
        qty: 0,
        cost: 10,
      }),
    ).toThrow()
    expect(
      receiveStockInput.parse({
        organizationId: org,
        warehouseId: wh,
        productId: prod,
        qty: 10,
        cost: 5,
      }).qty,
    ).toBe(10)
  })

  it('adjustStockInput accepts negative deltas but requires reason', () => {
    const batch = crypto.randomUUID()
    expect(() =>
      adjustStockInput.parse({ batchId: batch, delta: -5, reason: '' }),
    ).toThrow()
    expect(
      adjustStockInput.parse({ batchId: batch, delta: -5, reason: 'damaged' }).delta,
    ).toBe(-5)
  })

  it('transferStockInput enforces uuid warehouses', () => {
    expect(() =>
      transferStockInput.parse({
        organizationId: 'not-uuid',
        fromWarehouseId: wh,
        toWarehouseId: prod,
        productId: prod,
        qty: 1,
      }),
    ).toThrow()
  })

  it('reserveStockInput defaults allowPartial to false', () => {
    const r = reserveStockInput.parse({
      organizationId: org,
      productId: prod,
      qty: 3,
    })
    expect(r.allowPartial).toBe(false)
  })
})

describe('purchase order command schemas', () => {
  const org = crypto.randomUUID()
  it('rejects PO with zero lines', () => {
    expect(() =>
      createPurchaseOrderInput.parse({
        organizationId: org,
        supplierId: org,
        warehouseId: org,
        code: 'PO-001',
        lines: [],
      }),
    ).toThrow()
  })

  it('accepts PO with valid lines and defaults currency to SAR', () => {
    const po = createPurchaseOrderInput.parse({
      organizationId: org,
      supplierId: org,
      warehouseId: org,
      code: 'PO-001',
      lines: [{ product_id: org, qty_ordered: 5, unit_cost: 12.5 }],
    })
    expect(po.currency).toBe('SAR')
    expect(po.lines).toHaveLength(1)
  })
})
