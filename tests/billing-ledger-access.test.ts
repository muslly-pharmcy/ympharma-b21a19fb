import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const code = readFileSync(new URL('../src/lib/modules.functions.ts', import.meta.url), 'utf8')
const handler = code.slice(code.indexOf('export const listModuleTransactions ='))

describe('billing ledger display cannot mistake denied RLS reads for zero balances', () => {
  it('checks the authenticated caller admin role before querying the ledger', () => {
    expect(handler).toContain("sb.rpc('has_role',")
    expect(handler).toContain('_user_id: context.userId')
    expect(handler).toContain("_role: 'admin'")
    expect(handler).toContain('if (roleError || isAdmin !== true)')
    expect(handler.indexOf("sb.rpc('has_role'")).toBeLessThan(handler.indexOf(".from('billing_ledger')"))
  })
  it('fails on ledger query errors instead of inventing empty financial totals', () => {
    expect(handler).toContain("if (error) throw new Error(")
    expect(handler).not.toContain('amount_cents')
    expect(handler).not.toContain("type: 'income'")
  })
})
