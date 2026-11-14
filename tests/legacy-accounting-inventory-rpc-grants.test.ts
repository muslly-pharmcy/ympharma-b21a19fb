import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve('supabase/migrations/20261111213535_lock_legacy_accounting_inventory_rpcs_20261112.sql'),
  'utf8',
)

const signatures = [
  'acc_next_no(uuid, text)',
  'acc_post_entry(uuid, uuid)',
  'inv_consume_fefo(uuid, uuid, numeric, uuid)',
  'inv_movements_apply()',
  'sal_approve_invoice(uuid)',
]

describe('legacy accounting / stock RPC privileges', () => {
  for (const signature of signatures) {
    it(`revokes anonymous and signed-in direct execution for ${signature}`, () => {
      expect(migration).toContain(
        `REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated;`,
      )
      expect(migration).toContain(
        `GRANT EXECUTE ON FUNCTION public.${signature} TO service_role;`,
      )
    })
  }

  it('pins the search_path on legacy privileged stock routines', () => {
    expect(migration).toContain(
      'ALTER FUNCTION public.inv_consume_fefo(uuid, uuid, numeric, uuid) SET search_path = public, pg_temp;',
    )
    expect(migration).toContain(
      'ALTER FUNCTION public.inv_movements_apply() SET search_path = public, pg_temp;',
    )
  })

  it('checks effective privileges after the migration', () => {
    expect(migration).toContain("has_function_privilege('anon', sig, 'EXECUTE')")
    expect(migration).toContain("has_function_privilege('authenticated', sig, 'EXECUTE')")
    expect(migration).toContain("has_function_privilege('service_role', sig, 'EXECUTE')")
  })
})
