#!/usr/bin/env node
// Track D — server function auth audit.
// Walks src/lib/**/*.functions.ts, inspects every `createServerFn(...)` chain,
// and writes a markdown report to docs/engineering/SERVER-FN-AUDIT.md.
// Reports each exported server function with:
//   - method (GET/POST)
//   - .middleware([requireSupabaseAuth]) present? yes/no
//   - .inputValidator(...) present? yes/no
// No hard-coded whitelist. Everything is discovered by scanning source.

import { readdirSync, readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SRC = join(ROOT, 'src', 'lib')
const OUT = join(ROOT, 'docs', 'engineering', 'SERVER-FN-AUDIT.md')

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const s = statSync(p)
    if (s.isDirectory()) out.push(...walk(p))
    else if (entry.endsWith('.functions.ts')) out.push(p)
  }
  return out
}

// Match: export const NAME = createServerFn({ ... method: 'GET' ... }) ... .handler(
// then look at the chain segment between createServerFn and .handler
const FN_RE = /export\s+const\s+([A-Za-z0-9_]+)\s*=\s*createServerFn\s*\(\s*\{([^}]*)\}\s*\)([\s\S]*?)\.handler\s*\(/g

function classify(file) {
  const src = readFileSync(file, 'utf8')
  const fns = []
  let m
  while ((m = FN_RE.exec(src)) !== null) {
    const name = m[1]
    const opts = m[2]
    const chain = m[3]
    // Look at the full handler body to detect getActor() auth as well.
    const bodyStart = m.index + m[0].length
    const body = src.slice(bodyStart, bodyStart + 2000)
    const method = /method\s*:\s*['"](GET|POST|PUT|DELETE|PATCH)['"]/.exec(opts)?.[1] ?? 'POST'
    const middlewareAuth = /\.middleware\s*\(\s*\[[^\]]*requireSupabaseAuth[^\]]*\]/.test(chain)
    const actorAuth = /getActor\s*\(\s*\)|loadActor\s*\(\s*\)/.test(body)
    const authed = middlewareAuth || actorAuth
    const authMode = middlewareAuth ? 'middleware' : actorAuth ? 'actor' : 'none'
    const validated = /\.inputValidator\s*\(/.test(chain)
    fns.push({ name, method, authed, authMode, validated })
  }
  return fns
}

const files = walk(SRC).sort()
const rows = []
let total = 0
let authed = 0
let validated = 0
const publicFns = []

for (const f of files) {
  const rel = relative(ROOT, f)
  const fns = classify(f)
  for (const fn of fns) {
    total++
    if (fn.authed) authed++
    if (fn.validated) validated++
    if (!fn.authed) publicFns.push(`${rel} :: ${fn.name} (${fn.method})`)
    rows.push({ file: rel, ...fn })
  }
}

const md = []
md.push('# Server Function Auth Audit')
md.push('')
md.push(`Generated: ${new Date().toISOString()}`)
md.push('')
md.push(`- Total server functions scanned: **${total}**`)
md.push(`- Authenticated (\`requireSupabaseAuth\` **or** \`getActor()\`): **${authed}/${total}**`)
md.push(`- With \`inputValidator\`: **${validated}/${total}**`)
md.push(`- Unauthenticated (public endpoints): **${publicFns.length}**`)
md.push('')
md.push('> Any function without `requireSupabaseAuth` is a public endpoint on the deployed site. Confirm each is intentionally public (health checks, public reads via `TO anon` RLS, marketing forms with signature/rate-limit guards) or add the middleware.')
md.push('')

if (publicFns.length > 0) {
  md.push('## ⚠ Unauthenticated server functions')
  md.push('')
  for (const p of publicFns) md.push(`- ${p}`)
  md.push('')
}

md.push('## Full inventory')
md.push('')
md.push('| File | Function | Method | Auth | Mode | Validated |')
md.push('|---|---|---|---|---|---|')
for (const r of rows) {
  md.push(`| \`${r.file}\` | \`${r.name}\` | ${r.method} | ${r.authed ? '✅' : '❌'} | ${r.authMode} | ${r.validated ? '✅' : '—'} |`)
}
md.push('')

mkdirSync(join(ROOT, 'docs', 'engineering'), { recursive: true })
writeFileSync(OUT, md.join('\n'), 'utf8')
console.log(`Wrote ${relative(ROOT, OUT)} — ${authed}/${total} protected, ${publicFns.length} public.`)
