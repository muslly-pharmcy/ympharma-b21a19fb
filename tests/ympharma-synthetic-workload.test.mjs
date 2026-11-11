import { describe, it, expect } from 'vitest'
import { invoiceFixture, journalFixture } from '../scripts/load/ympharma-synthetic-fixtures.mjs'

describe('synthetic capacity workload fixtures', () => {
  it('distributes across 30 branches and 150 cashiers', () => {
    const invoices = Array.from({ length: 150 }, (_, i) => invoiceFixture(i + 1))
    expect(new Set(invoices.map(x => x.branch)).size).toBe(30)
    expect(new Set(invoices.map(x => x.cashier)).size).toBe(150)
  })
  it('creates deterministic unique keys for invoice and ledger operations', () => {
    const ids = new Set()
    for (let i = 1; i <= 2000; i++) {
      ids.add(invoiceFixture(i).idempotency_key)
      ids.add(journalFixture(i).idempotency_key)
    }
    expect(ids.size).toBe(4000)
  })
  it('uses 4-decimal monetary strings and exactly balances synthetic journals', () => {
    const j = journalFixture(7)
    expect(j.lines[0].debit).toMatch(/^\d+\.\d{4}$/)
    expect(j.lines[0].debit).toBe(j.lines[1].credit)
    expect(j.lines[1].debit).toBe('0.0000')
  })
  it('marks synthetic stock as non-production', () => {
    expect(invoiceFixture(1).never_use_as_production_stock).toBe(true)
  })
})
