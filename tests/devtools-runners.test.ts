import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

// Exercise real Node ESM entrypoints in an isolated copy; never invoke scanners.
const fixture = mkdtempSync(join(tmpdir(), 'ympharma-devtools-'))
mkdirSync(join(fixture, 'scripts/devtools'), { recursive: true })
mkdirSync(join(fixture, 'staging-scan'))
writeFileSync(join(fixture, 'package.json'), '{"type":"module"}')
for (const name of ['strix-scan.js', 'ctx7-check.js', 'skillui-extract.js', 'strix-allowlist.json']) {
  writeFileSync(join(fixture, 'scripts/devtools', name), readFileSync(`scripts/devtools/${name}`))
}
afterAll(() => rmSync(fixture, { recursive: true, force: true }))
function run(name: string, args: string[] = [], env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [join(fixture, 'scripts/devtools', name), ...args], {
    encoding: 'utf8', cwd: tmpdir(),
    env: { ...process.env, SECURITY_STRIX_DOCKER: '', SCAN_TARGET: '', STRIX_IMAGE: '', CTX7_ALLOW: '', SKILLUI_ALLOW: '', ...env },
  })
}
describe('developer tool entrypoints', () => {
  for (const name of ['strix-scan.js', 'ctx7-check.js', 'skillui-extract.js']) {
    it(`${name}: help loads as ESM`, () => {
      const result = run(name, ['--help'])
      expect(result.status).toBe(0)
      expect(result.stderr).toBe('')
    })
    it(`${name}: opt-in is required`, () => {
      const result = run(name)
      expect(result.status).toBe(2)
      expect(result.stderr).toContain('Blocked:')
      expect(result.stderr).not.toContain('ReferenceError')
    })
  }
  it('Strix uses the object allowlist and pinned image from a different cwd', () => {
    const result = run('strix-scan.js', ['--dry-run'], { SECURITY_STRIX_DOCKER: '1', SCAN_TARGET: './staging-scan' })
    expect(result.status).toBe(0)
    const plan = JSON.parse(result.stdout)
    expect(plan.command).toBe('docker')
    expect(plan.args).toContain('ghcr.io/usestrix/strix-sandbox:1.3.0')
    expect(plan.args).toContain('/work/staging-scan')
  })
  for (const target of ['./staging-scan/**', '../', './staging-scan;echo injected']) {
    it(`Strix rejects ${target}`, () => {
      expect(run('strix-scan.js', ['--dry-run'], { SECURITY_STRIX_DOCKER: '1', SCAN_TARGET: target }).status).toBe(2)
    })
  }
  it('Strix refuses image overrides', () => {
    expect(run('strix-scan.js', ['--dry-run'], { SECURITY_STRIX_DOCKER: '1', SCAN_TARGET: './staging-scan', STRIX_IMAGE: 'other:latest' }).status).toBe(2)
  })
})
