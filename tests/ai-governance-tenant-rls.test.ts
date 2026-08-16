import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('AI governance RLS tenant boundary', () => {
  const migration = readFileSync(
    resolve('supabase/migrations/20260816050000_lock_ai_governance_to_member_org.sql'),
    'utf8',
  )

  it.each(['air_policies', 'air_budgets', 'air_capabilities'])(
    'requires organization membership when writing %s',
    (table) => {
      expect(migration).toContain(`DROP POLICY IF EXISTS ${table === 'air_capabilities' ? 'air_caps_write' : `${table}_write`} ON public.${table};`)
      expect(migration).toMatch(new RegExp(`CREATE POLICY [\\w_]+ ON public\\.${table}[\\s\\S]*?FOR ALL TO authenticated[\\s\\S]*?USING \\([\\s\\S]*?organization_id IN \\([\\s\\S]*?FROM public\\.organization_members[\\s\\S]*?WHERE user_id = auth\\.uid\\(\\)[\\s\\S]*?WITH CHECK \\([\\s\\S]*?organization_id IN \\([\\s\\S]*?FROM public\\.organization_members`))
    },
  )
})
