import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspaceFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const prohibitedOracleSql = /\b(INSERT|UPDATE|DELETE|MERGE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|EXECUTE|BEGIN|COMMIT|ROLLBACK)\b/i

describe('Oracle connector read-only safety', () => {
  it('keeps every configured Oracle mapping disabled and SELECT-only by default', () => {
    const mapping = JSON.parse(workspaceFile('config/oracle-sync.mapping.example.json')) as {
      entities: Array<{ enabled: boolean; query: string }>
    }

    expect(mapping.entities.length).toBeGreaterThan(0)
    for (const entity of mapping.entities) {
      expect(entity.enabled).toBe(false)
      expect(entity.query).toMatch(/^\s*SELECT\b/i)
      expect(entity.query).not.toMatch(prohibitedOracleSql)
    }
  })

  it('opens OraOLEDB in read-only mode and rejects write/control keywords', () => {
    const connector = workspaceFile('scripts/oracle-supabase-sync.ps1')

    expect(connector).toContain("$connection.Mode = 1")
    expect(connector).toContain("if ($Query -notmatch '^\\s*SELECT\\b')")
    for (const keyword of [
      'INSERT',
      'UPDATE',
      'DELETE',
      'MERGE',
      'ALTER',
      'DROP',
      'TRUNCATE',
      'GRANT',
      'REVOKE',
      'EXECUTE',
      'BEGIN',
      'COMMIT',
      'ROLLBACK',
    ]) {
      expect(connector).toContain(keyword)
    }
  })

  it('uses a dictionary SELECT and read-only connection for schema discovery', () => {
    const discovery = workspaceFile('scripts/oracle-schema-discovery.ps1')

    expect(discovery).toContain("$connection.Mode = 1")
    expect(discovery).toContain('FROM ALL_TAB_COLUMNS c')
    expect(discovery).toContain('WHERE ROWNUM <= $safeLimit')
    expect(discovery).not.toMatch(/\.Execute\(\s*["']\s*(INSERT|UPDATE|DELETE|MERGE|ALTER|DROP|TRUNCATE)\b/i)
  })
})
