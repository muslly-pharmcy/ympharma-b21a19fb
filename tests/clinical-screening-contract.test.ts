import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Static boundary guards for the clinical-screening domain.
 *
 * These fail closed on the patterns that would make a clinical feature
 * unauditable: a direct AI/server import from a component, a server function
 * without a permission check, or a dispense gate that runs after stock is
 * consumed.
 */
const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf8').replace(/\r\n/g, '\n')
}

function walk(dir: string, extension: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full, extension))
    else if (entry.name.endsWith(extension)) out.push(full)
  }
  return out
}

const FORBIDDEN_IMPORTS = [
  '@/lib/ai/provider.server',
  '@/lib/ai/gateway.server',
  '@/lib/clinical-screening.server',
  '@/lib/clinical-screening-summary.server',
  '@/integrations/supabase/client.server',
]

describe('clinical screening boundaries', () => {
  it('never imports server-only or AI modules from components or routes', () => {
    const files = [...walk(resolve(root, 'src/components'), '.tsx'), ...walk(resolve(root, 'src/routes'), '.tsx')]
    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8')
      return FORBIDDEN_IMPORTS.some((moduleName) => source.includes(moduleName))
    })
    expect(offenders.map((file) => file.replace(`${root}/`, ''))).toEqual([])
  })

  it('keeps every screening server function authenticated and permission checked', () => {
    const source = read('src/lib/clinical-screening.functions.ts')
    const handlers = source.match(/createServerFn\(/g)?.length ?? 0
    expect(handlers).toBe(4)
    expect(source.match(/await getActor\(\)/g)?.length).toBe(handlers)
    expect(source).toContain("requirePermission(actor, 'dispense.verify')")
    expect(source).toContain("requirePermission(actor, 'dispense.read')")
    expect(source).not.toContain("from '@/integrations/supabase/client.server'")
  })

  it('checks the critical-screening gate before consuming stock', () => {
    const source = read('src/lib/dispenses.mutations.functions.ts')
    const start = source.indexOf('export const dispensePrescription')
    const end = source.indexOf('export const completeDispense')
    const body = source.slice(start, end)
    expect(body).toContain('getBlockingDispenseScreening')
    expect(body.indexOf('getBlockingDispenseScreening')).toBeLessThan(
      body.indexOf('inv_consume_reservation'),
    )
    expect(body).toContain('Screening override required')
  })

  it('keeps verification advisory and records evidence on approval', () => {
    const dispenses = read('src/lib/dispenses.mutations.functions.ts')
    const verifyStart = dispenses.indexOf('export const verifyDispense')
    const verifyEnd = dispenses.indexOf('export const dispensePrescription')
    const verifyBody = dispenses.slice(verifyStart, verifyEnd)
    expect(verifyBody).toContain('runDispenseScreening')
    expect(verifyBody).not.toContain('Screening override required')

    const prescriptions = read('src/lib/prescriptions.mutations.functions.ts')
    expect(prescriptions).toContain('runPrescriptionScreening')
    expect(prescriptions).toContain("data.to === 'approved'")
  })

  it('has no hand-written duplicate of the severity ranking in the UI', () => {
    const panel = read('src/components/clinical/DispenseScreeningPanel.tsx')
    expect(panel).toContain('SEVERITY_LABEL_AR')
    expect(panel).not.toContain("critical: 0")
    const stat = statSync(resolve(root, 'src/components/clinical/DispenseScreeningPanel.tsx'))
    expect(stat.isFile()).toBe(true)
  })
})
