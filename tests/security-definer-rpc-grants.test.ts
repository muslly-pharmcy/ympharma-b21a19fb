import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('privileged RPC grants', () => {
  const migration = readFileSync(
    resolve('supabase/migrations/20260816040000_omni_architect_lock_internal_rpcs.sql'),
    'utf8',
  )

  const dlqAuthorizationMigration = readFileSync(
    resolve('supabase/migrations/20261010072200_authorize_agent_events_dlq_stats.sql'),
    'utf8',
  )

  it('keeps organization-mutating inventory RPCs off the authenticated Data API', () => {
    for (const name of ['inv_receive_stock', 'inv_adjust_stock', 'inv_transfer_stock', 'po_receive']) {
      expect(migration).toContain(`REVOKE ALL ON FUNCTION public.${name}`)
      expect(migration).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}[\\s\\S]*?FROM PUBLIC, anon, authenticated`))
    }
  })

  it('retains only the trusted server role for the locked RPCs', () => {
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.emit_domain_event(text, text, jsonb, text, text) TO service_role;')
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.ensure_user_organization(uuid) TO service_role;')
  })

  it('checks the existing operator authorization before reading DLQ statistics', () => {
    const guard = dlqAuthorizationMigration.indexOf(
      "IF auth.role() IS DISTINCT FROM 'service_role'\n     AND NOT public._intel_can_manage() THEN",
    )
    const firstQueueRead = dlqAuthorizationMigration.indexOf(
      'SELECT COUNT(*) INTO total FROM public.agent_events_dlq',
    )

    expect(guard).toBeGreaterThanOrEqual(0)
    expect(firstQueueRead).toBeGreaterThan(guard)
    expect(dlqAuthorizationMigration).toContain(
      "RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';",
    )
  })

  it('keeps the DLQ RPC off PUBLIC/anon while retaining authenticated and service-role grants', () => {
    expect(dlqAuthorizationMigration).toContain(
      'REVOKE ALL ON FUNCTION public.agent_events_dlq_stats()\n  FROM PUBLIC, anon, authenticated, service_role;',
    )
    expect(dlqAuthorizationMigration).toContain(
      'GRANT EXECUTE ON FUNCTION public.agent_events_dlq_stats()\n  TO authenticated, service_role;',
    )
  })
})
