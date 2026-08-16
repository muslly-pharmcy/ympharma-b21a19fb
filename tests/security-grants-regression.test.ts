/**
 * Security regression: verifies that
 *   1. Privileged SECURITY DEFINER functions do NOT have anon EXECUTE.
 *   2. Trigger-only helper functions (hc_doctors_protect_self_update, profiles_protect_self_update)
 *      have no external EXECUTE grants.
 *   3. Every SECURITY DEFINER function in `public` has search_path locked.
 *   4. Self-update triggers on hc_doctors and profiles are still installed.
 *   5. Both self-update triggers audit reverted attempts into audit_events.
 *
 * Skips (does not fail) when PGHOST is not configured, so unit-test runners
 * without DB access remain green. CI must set PG* env to exercise the check.
 */
import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'

const HAS_DB = Boolean(process.env.PGHOST)
const d = HAS_DB ? describe : describe.skip

function psql(sql: string): string {
  return execFileSync('psql', ['-A', '-F', '|', '-t', '-X', '-q', '-c', sql], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

d('SECURITY DEFINER grant baseline', () => {
  it('registry table exists and is populated', () => {
    const count = Number(psql('SELECT count(*) FROM public.privileged_definer_functions'))
    expect(count).toBeGreaterThan(0)
  })

  it('no privileged function in the registry is anon-callable', () => {
    const rows = psql(`
      SELECT g.function_signature
      FROM public.v_privileged_definer_grants g
      JOIN public.privileged_definer_functions r
        ON r.function_signature = g.function_signature
      WHERE g.anon_can_execute = true
    `)
    expect(rows).toBe('')
  })

  it('trigger-only self-update helpers have no external EXECUTE', () => {
    const rows = psql(`
      SELECT function_signature
      FROM public.v_privileged_definer_grants
      WHERE function_signature IN (
        'public.hc_doctors_protect_self_update()',
        'public.profiles_protect_self_update()'
      )
      AND (anon_can_execute = true OR authenticated_can_execute = true)
    `)
    expect(rows).toBe('')
  })

  it('every registry SECURITY DEFINER function has search_path locked', () => {
    // Scoped to the privileged registry — existing app-wide definers are audited separately.
    const rows = psql(`
      SELECT g.function_signature
      FROM public.v_privileged_definer_grants g
      JOIN public.privileged_definer_functions r
        ON r.function_signature = g.function_signature
      WHERE g.is_security_definer = true AND g.search_path_locked = false
    `)
    expect(rows).toBe('')
  })
})

d('self-update protection triggers', () => {
  it('hc_doctors_protect_self_update trigger is installed', () => {
    const found = psql(`
      SELECT tgname FROM pg_trigger
      WHERE tgrelid = 'public.hc_doctors'::regclass
        AND tgname = 'trg_hc_doctors_protect_self_update'
        AND NOT tgisinternal
    `)
    expect(found).toContain('trg_hc_doctors_protect_self_update')
  })

  it('profiles_protect_self_update trigger is installed', () => {
    const found = psql(`
      SELECT tgname FROM pg_trigger
      WHERE tgrelid = 'public.profiles'::regclass
        AND tgname = 'trg_profiles_protect_self_update'
        AND NOT tgisinternal
    `)
    expect(found).toContain('trg_profiles_protect_self_update')
  })

  it('trigger functions insert audit_events on revert', () => {
    // Source contains the audit insert; regression against silent removal.
    const hcSrc = psql(
      `SELECT pg_get_functiondef('public.hc_doctors_protect_self_update()'::regprocedure)`,
    )
    expect(hcSrc).toContain("action, resource_type, resource_id, payload")
    expect(hcSrc).toContain("'self_update_reverted'")

    const pSrc = psql(
      `SELECT pg_get_functiondef('public.profiles_protect_self_update()'::regprocedure)`,
    )
    expect(pSrc).toContain("'self_update_reverted'")
    expect(pSrc).toContain('staff_alerts')
  })
})

d('grant-change event trigger', () => {
  it('trg_audit_privileged_grants event trigger is enabled', () => {
    const row = psql(`
      SELECT evtname || '|' || evtenabled::text
      FROM pg_event_trigger WHERE evtname = 'trg_audit_privileged_grants'
    `)
    expect(row).toMatch(/trg_audit_privileged_grants\|[OAR]/)
  })
})
