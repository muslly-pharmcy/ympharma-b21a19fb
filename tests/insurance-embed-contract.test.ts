import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

type Relation = { source: string; target: string; constraint: string }
const originalSchema = readFileSync(resolve('supabase/migrations/20260720101754_b46295c1-235b-44db-8fde-b7390f9533ec.sql'), 'utf8')
const ownershipSchema = readFileSync(resolve('supabase/migrations/20261015120000_insurance_reference_ownership.sql'), 'utf8')

// Derive the relation inventory from both migrations, so this contract checks
// ambiguity caused by the actual schema change, including nested embeds.
const originalRelations: Relation[] = []
for (const table of originalSchema.matchAll(/CREATE TABLE public\.(\w+) \(([\s\S]*?)\n\);/g)) {
  for (const reference of table[2].matchAll(/^\s*(\w+) uuid(?: NOT NULL)? REFERENCES public\.(\w+)\(id\)/gm)) {
    originalRelations.push({ source: table[1], target: reference[2], constraint: `${table[1]}_${reference[1]}_fkey` })
  }
}
const addedRelations: Relation[] = []
for (const table of ownershipSchema.matchAll(/ALTER TABLE public\.(\w+)\s+([\s\S]*?);/g)) {
  for (const reference of table[2].matchAll(/ADD CONSTRAINT (\w+) FOREIGN KEY \([^)]+\)\s+REFERENCES public\.(\w+)/g)) {
    addedRelations.push({ source: table[1], target: reference[2], constraint: reference[1] })
  }
}

function splitFields(selection: string) {
  const fields: string[] = []
  let depth = 0, start = 0
  for (let i = 0; i < selection.length; i++) {
    if (selection[i] === '(') depth++
    if (selection[i] === ')') depth--
    if (selection[i] === ',' && depth === 0) {
      fields.push(selection.slice(start, i).trim())
      start = i + 1
    }
  }
  fields.push(selection.slice(start).trim())
  return fields
}

function resolveEmbeds(source: string, selection: string, relations: Relation[]): string[] {
  const constraints: string[] = []
  for (const field of splitFields(selection)) {
    if (!field.includes('(')) continue
    const parsed = field.match(/^(?:\w+:)?(\w+)(?:!(\w+))?\((.*)\)$/s)
    if (!parsed) throw new Error(`Unsupported select syntax: ${field}`)
    const [, target, hint, nested] = parsed
    const matches = relations.filter((relation) =>
      relation.source === source && relation.target === target && (!hint || relation.constraint === hint),
    )
    if (matches.length !== 1) throw new Error(`Relation must be unambiguous: ${source} -> ${target} (${matches.length} matches)`)
    constraints.push(matches[0].constraint, ...resolveEmbeds(target, nested, relations))
  }
  return constraints
}

const queries = ['src/lib/insurance.functions.ts', 'src/lib/insurance.mutations.functions.ts'].flatMap((file) => {
  const source = readFileSync(resolve(file), 'utf8')
  return [...source.matchAll(/\.from\('([^']+)'\)\s*\.select\('([^']+)'\)/g)]
    .filter((match) => match[2].includes('('))
    .map((match) => ({ file, table: match[1], selection: match[2] }))
})

describe('insurance PostgREST embed contract across the ownership migration', () => {
  it('covers the six read queries and all thirteen added foreign-key relationships', () => {
    expect(queries).toHaveLength(6)
    expect(addedRelations).toHaveLength(13)
    expect(queries.flatMap((query) => resolveEmbeds(query.table, query.selection, originalRelations))).toHaveLength(13)
  })

  it.each(queries)('keeps $file $table embeds unambiguous before and after migration', (query) => {
    const before = resolveEmbeds(query.table, query.selection, originalRelations)
    const after = resolveEmbeds(query.table, query.selection, [...originalRelations, ...addedRelations])
    expect(after).toEqual(before)
    expect(before.length).toBeGreaterThan(0)
  })

  it.each(queries)('detects the previous missing-hint regression in $file $table', (query) => {
    const previousSelection = query.selection.replace(/!\w+_fkey/g, '')
    expect(() => resolveEmbeds(query.table, previousSelection, originalRelations)).not.toThrow()
    expect(() => resolveEmbeds(query.table, previousSelection, [...originalRelations, ...addedRelations]))
      .toThrow('Relation must be unambiguous')
  })

  it('rejects an incorrect FK hint instead of treating any hint as adequate', () => {
    expect(() => resolveEmbeds('insv2_plans', 'provider:insv2_providers!nonexistent_fkey(id)', originalRelations))
      .toThrow('0 matches')
  })
})
