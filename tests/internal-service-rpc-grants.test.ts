import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('internal scheduled and inventory RPC privileges', () => {
  const sql = readFileSync(
    resolve('supabase/migrations/20261111215832_restrict_internal_backup_inventory_event_rpcs_20261112.sql'),
    'utf8',
  )
  for (const signature of [
    'create_scheduled_backup(text)',
    'inv_intel_snapshot()',
    'inv_emit_event(text, uuid, text, uuid, jsonb)',
  ]) {
    it(`blocks browser-role execution of ${signature}`, () => {
      expect(sql).toContain(`REVOKE EXECUTE ON FUNCTION public.${signature}`)
      expect(sql).toContain('FROM PUBLIC, anon, authenticated;')
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${signature} TO service_role;`)
    })
  }
  it('asserts effective permissions at migration time', () => {
    expect(sql).toContain("has_function_privilege('anon',sig,'EXECUTE')")
    expect(sql).toContain("has_function_privilege('authenticated',sig,'EXECUTE')")
    expect(sql).toContain("has_function_privilege('service_role',sig,'EXECUTE')")
  })
})
