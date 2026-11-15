import { describe, expect, it } from 'vitest'
import { excelProductRow } from '@/lib/excel-import-schema'

describe('catalog import does not fabricate inventory', () => {
  const row = { store_code: 'SYNTHETIC-1', name_ar: 'صنف تجريبي' }
  it.each([undefined, null, 0])('accepts metadata-only import with qty %s', (qty) => {
    expect(excelProductRow.safeParse({ ...row, qty }).success).toBe(true)
  })
  it.each([5, -1, Infinity, NaN])('rejects stock quantity %s before the handler can write a product', (qty) => {
    expect(excelProductRow.safeParse({ ...row, qty }).success).toBe(false)
  })
})
