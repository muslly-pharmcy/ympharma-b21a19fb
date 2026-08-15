/**
 * Patient identity contract.
 *
 * Guards the invariants of the single canonical identity chain:
 *   Auth user -> profiles -> exactly ONE hc_patients row
 *
 * These are source-level guards: the handler runs only on the server with an
 * authenticated Supabase client, so the regression we protect against is a
 * future edit reintroducing name-based lookup, overwriting verified profile
 * data, or dropping the auth middleware.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SOURCE = readFileSync(
  join(process.cwd(), 'src', 'lib', 'patient-identity.functions.ts'),
  'utf8',
)

describe('ensurePatientIdentity source contract', () => {
  it('runs behind the authenticated server-function middleware', () => {
    expect(SOURCE).toContain('requireSupabaseAuth')
    expect(SOURCE).toMatch(/\.middleware\(\[requireSupabaseAuth\]\)/)
  })

  it('resolves the patient row by user id only', () => {
    expect(SOURCE).toContain("from('hc_patients')")
    expect(SOURCE).toMatch(/\.eq\('user_id', userId\)/)
  })

  it('never looks up or matches a patient by name', () => {
    const patientQuery = SOURCE.slice(SOURCE.indexOf("from('hc_patients')"))
    expect(patientQuery).not.toMatch(/\.eq\('full_name'/)
    expect(patientQuery).not.toMatch(/\.ilike\(/)
    expect(patientQuery).not.toMatch(/\.or\(/)
  })

  it('does not use the service-role admin client', () => {
    expect(SOURCE).not.toContain('supabaseAdmin')
    expect(SOURCE).not.toContain('client.server')
  })

  it('fills the profile name only when it is still empty', () => {
    expect(SOURCE).toContain('!profileFullName')
  })

  it('handles a concurrent insert by re-reading instead of creating a second row', () => {
    expect(SOURCE).toContain('concurrent')
    expect(SOURCE).toMatch(/const \{ data: retry \}/)
  })
})
