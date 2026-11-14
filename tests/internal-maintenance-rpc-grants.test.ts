import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('cron/report maintenance routines deny direct browser access', () => {
  const sql = readFileSync(
    resolve('supabase/migrations/20261111221813_restrict_internal_reporting_retention_cron_20261112.sql'),
    'utf8',
  )
  for (const signature of [
    'monitor_cron_failures()',
    'reconcile_inventory_mismatch()',
    'run_retention_policy()',
    'weekly_exec_report_build()',
  ]) {
    it(`locks ${signature}`, () => {
      expect(sql).toContain(`REVOKE EXECUTE ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated;`)
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${signature} TO service_role;`)
    })
  }
  it('verifies the postgres cron owner remains executable', () => {
    expect(sql).toContain("has_function_privilege('postgres', signature, 'EXECUTE')")
  })
})
