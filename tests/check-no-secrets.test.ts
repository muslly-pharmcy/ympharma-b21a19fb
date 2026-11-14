import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

/**
 * Regression guard for scripts/check-no-secrets.mjs. The scanner is the last
 * line of defence before a build is pushed, so it must be proven to fail on a
 * planted secret — not just to pass on a clean tree.
 */
const script = resolve(process.cwd(), 'scripts/check-no-secrets.mjs')
const created: string[] = []

function probe(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-secret-scan-'))
  created.push(dir)
  for (const [name, content] of Object.entries(files)) {
    const full = join(dir, name)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, content, 'utf8')
  }
  return dir
}

function run(dir: string, args: string[] = []): { status: number; output: string } {
  const result = spawnSync(process.execPath, [script, dir, ...args], { encoding: 'utf8' })
  return {
    status: result.status ?? -1,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  }
}

afterEach(() => {
  for (const dir of created.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('check-no-secrets', () => {
  it('passes a clean output directory', () => {
    const dir = probe({ 'app.js': 'console.log("hello")' })
    expect(run(dir).status).toBe(0)
  })

  it('fails on a planted provider key', () => {
    const dir = probe({ 'app.js': 'const k = "sk-proj-abcdefghijklmnopqrstuvwx1234567890"' })
    const result = run(dir)
    expect(result.status).toBe(1)
    expect(result.output).toContain('openai-or-stripe-key')
  })

  it('fails on a JWT signed for the service role', () => {
    const dir = probe({
      'app.js':
        'const t = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abcdefghijklmnopqrstuvwxyz123456"',
    })
    const result = run(dir)
    expect(result.status).toBe(1)
    expect(result.output).toContain('jwt-signed-for-service-role')
  })

  it('fails when an environment file is shipped', () => {
    const dir = probe({ '.env.production': 'SUPABASE_SERVICE_ROLE_KEY=secret' })
    const result = run(dir)
    expect(result.status).toBe(1)
    expect(result.output).toContain('env-file-in-output')
  })

  it('warns (but passes) on a service-role identifier in client code, and fails in --strict', () => {
    const dir = probe({
      'client/app.js':
        'if (!process.env.SUPABASE_SERVICE_ROLE_KEY) console.warn("missing")',
    })
    expect(run(dir).status).toBe(0)
    expect(run(dir).output).toContain('service-role-identifier-in-client')

    const strict = run(dir, ['--strict'])
    expect(strict.status).toBe(1)
    expect(strict.output).toContain('service-role-identifier-in-client')
  })

  it('ignores a bare PEM header used in library error messages', () => {
    const dir = probe({
      'lib.js': "if (value.indexOf('-----BEGIN PRIVATE KEY-----') !== 0) throw new Error('bad')",
    })
    expect(run(dir).status).toBe(0)
  })

  it('fails on an embedded private key block', () => {
    const body = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj'
    const dir = probe({
      'leak.js': `const pem = "-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----"`,
    })
    const result = run(dir)
    expect(result.status).toBe(1)
    expect(result.output).toContain('private-key')
  })

  it('fails when the target directory does not exist', () => {
    const result = run(join(tmpdir(), 'dsh-secret-scan-does-not-exist'))
    expect(result.status).toBe(1)
    expect(result.output).toContain('target not found')
  })
})
