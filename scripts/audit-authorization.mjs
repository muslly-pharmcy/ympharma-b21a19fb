#!/usr/bin/env node
// Wave R1.3 — Authorization & Tenant Audit.
// Static analysis of every exported server function in src/lib/**/*.functions.ts.
// For each function extracts:
//   - auth mode (middleware requireSupabaseAuth | actor helper | none)
//   - data-access mode (context.supabase = RLS-scoped | supabaseAdmin = RLS bypass | anon publishable)
//   - explicit organization_id filter present?
//   - role check present (has_role RPC, claims.role, requireRole, admin gates)?
//   - inputValidator present?
// Emits docs/engineering/WAVE-R1.3-AUTHZ-AUDIT.md with a decision table and
// counts per verdict. No hard-coded whitelist; verdict derived from evidence.

import { readdirSync, readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SRC = join(ROOT, 'src', 'lib')
const OUT = join(ROOT, 'docs', 'engineering', 'WAVE-R1.3-AUTHZ-AUDIT.md')

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

// Match an exported server fn declaration and capture the ENTIRE tail up to
// the next `export const ... createServerFn` or end-of-file. This gives us
// both the chain (middleware/validator) and the handler body in one slice.
const DECL_RE = /export\s+const\s+([A-Za-z0-9_]+)\s*=\s*createServerFn\s*\(\s*\{([^}]*)\}\s*\)/g

function sliceFn(src, startIdx) {
  const next = src.slice(startIdx).search(/export\s+const\s+[A-Za-z0-9_]+\s*=\s*createServerFn\s*\(/)
  return next === -1 ? src.slice(startIdx) : src.slice(startIdx, startIdx + next)
}

function classify(file) {
  const src = readFileSync(file, 'utf8')
  const fns = []
  let m
  while ((m = DECL_RE.exec(src)) !== null) {
    const name = m[1]
    const opts = m[2]
    const method = /method\s*:\s*['"](GET|POST|PUT|DELETE|PATCH)['"]/.exec(opts)?.[1] ?? 'POST'
    const bodyStart = m.index + m[0].length
    const body = sliceFn(src, bodyStart)

    const middlewareAuth = /\.middleware\s*\(\s*\[[^\]]*requireSupabaseAuth[^\]]*\]/.test(body)
    const actorAuth = /getActor\s*\(\s*\)|loadActor\s*\(\s*\)|requireActor\s*\(/.test(body)
    const authed = middlewareAuth || actorAuth
    const authMode = middlewareAuth ? 'middleware' : actorAuth ? 'actor' : 'none'

    const usesContextSb = /\bcontext\.supabase\b/.test(body)
    const usesAdmin = /\bsupabaseAdmin\b|client\.server/.test(body)
    const usesAnonPublishable = /supabase-public\.server|createPublishableClient|SUPABASE_PUBLISHABLE_KEY/.test(body)

    const dataMode = usesContextSb && !usesAdmin
      ? 'rls'
      : usesAdmin && !usesContextSb
        ? 'admin-bypass'
        : usesAdmin && usesContextSb
          ? 'mixed'
          : usesAnonPublishable
            ? 'anon-publishable'
            : 'none'

    // Tenant-scope signals: explicit org_id in query, requireOrg helper,
    // actor.organizationId cross-check, or an assert*InOrg guard helper.
    const orgFilter = /organization_id\s*[:=]|\.eq\(\s*['"]organization_id['"]|requireOrg\s*\(|actor\.organizationId|assert\w*InOrg\s*\(/.test(body)
    // Role / permission signals: DB role helpers, RBAC calls, or capability guards.
    const roleCheck = /has_role|hasRole|requireRole|requirePermission\s*\(|is_admin|claims\.role|role\s*===\s*['"]admin['"]|['"]admin['"]\s*,\s*['"]moderator['"]|assertAdmin|ensureAdmin|requireCapability/.test(body)
    const validated = /\.inputValidator\s*\(/.test(body.split('.handler')[0] ?? body)

    // Verdict:
    // ❌ tenant-leak-risk: authed + admin-bypass + no org filter + no role check
    // ⚠️ admin-bypass-review: authed + admin-bypass + (org filter OR role check)
    // ✅ rls-role: authed + rls + role check
    // ✅ rls-only: authed + rls (or mixed) — RLS is the enforcement plane
    // ✅ public-anon: not authed + uses anon publishable client (matches R1.2 public verdict)
    // ⚠️ public-unclassified: not authed + no anon publishable evidence
    let verdict
    if (!authed) {
      verdict = usesAnonPublishable || dataMode === 'anon-publishable' ? 'public-anon' : 'public-unclassified'
    } else if (dataMode === 'admin-bypass') {
      verdict = orgFilter || roleCheck ? 'admin-bypass-review' : 'tenant-leak-risk'
    } else if (dataMode === 'rls' || dataMode === 'mixed' || dataMode === 'anon-publishable') {
      verdict = roleCheck ? 'rls-role' : 'rls-only'
    } else {
      // authed but no DB access detected (helpers, orchestrators) — safe
      verdict = 'no-db-access'
    }

    fns.push({
      name, method, authed, authMode, dataMode,
      orgFilter, roleCheck, validated, verdict,
    })
  }
  return fns
}

const files = walk(SRC).sort()
const rows = []
const counts = {}
for (const f of files) {
  const rel = relative(ROOT, f)
  for (const fn of classify(f)) {
    counts[fn.verdict] = (counts[fn.verdict] ?? 0) + 1
    rows.push({ file: rel, ...fn })
  }
}
const total = rows.length

const VERDICT_LABEL = {
  'rls-only': '✅ RLS-only',
  'rls-role': '✅ RLS + role check',
  'admin-bypass-review': '⚠️ Admin bypass (org/role gated — review)',
  'tenant-leak-risk': '❌ Tenant-leak risk',
  'public-anon': '✅ Public by design (anon publishable)',
  'public-unclassified': '⚠️ Public — unclassified (R1.2 documented)',
  'no-db-access': '✅ Authed, no direct DB access',
}

const md = []
md.push('# Wave R1.3 — Authorization & Tenant Audit')
md.push('')
md.push(`Generated: ${new Date().toISOString()}`)
md.push('')
md.push('Auto-generated by `node scripts/audit-authorization.mjs`. Companion to')
md.push('`SERVER-FN-AUDIT.md` (Wave D) and `WAVE-R1.2-PUBLIC-FUNCTION-REVIEW.md` (Wave R1.2).')
md.push('')
md.push('**Question answered:** for each authenticated server function — is the caller')
md.push('actually _authorized_ for the data it touches?')
md.push('')
md.push('## Verdict summary')
md.push('')
md.push(`- Total server functions scanned: **${total}**`)
for (const [k, label] of Object.entries(VERDICT_LABEL)) {
  const n = counts[k] ?? 0
  md.push(`- ${label}: **${n}**`)
}
md.push('')
md.push('## Decision rules (static evidence only)')
md.push('')
md.push('- **RLS-only** — uses `context.supabase` (RLS evaluated under the caller\'s')
md.push('  JWT); no direct role check in code. Safe when the underlying table has')
md.push('  a tenant-scoped RLS policy.')
md.push('- **RLS + role check** — same as above plus an explicit `has_role`/admin')
md.push('  gate. Least-privilege documented.')
md.push('- **Admin bypass (gated)** — loads `supabaseAdmin` (bypasses RLS). Has')
md.push('  either an explicit `organization_id` filter or a role check. Requires')
md.push('  human review — evidence table below.')
md.push('- **Tenant-leak risk** — loads `supabaseAdmin` with neither an')
md.push('  `organization_id` filter nor a role check. Must be fixed.')
md.push('- **Public (anon publishable)** — no auth middleware, uses the anon')
md.push('  publishable client. Matches Wave R1.2 verdicts.')
md.push('- **Authed, no direct DB access** — authenticated helper/orchestrator')
md.push('  that delegates DB work to another authenticated server layer.')
md.push('')

function tableSection(title, verdictKey) {
  const sub = rows.filter(r => r.verdict === verdictKey)
  if (sub.length === 0) return
  md.push(`## ${title} — ${sub.length}`)
  md.push('')
  md.push('| File | Function | Method | Data mode | Org filter | Role check | Validator |')
  md.push('|---|---|---|---|---|---|---|')
  for (const r of sub) {
    md.push(`| \`${r.file}\` | \`${r.name}\` | ${r.method} | ${r.dataMode} | ${r.orgFilter ? '✅' : '—'} | ${r.roleCheck ? '✅' : '—'} | ${r.validated ? '✅' : '—'} |`)
  }
  md.push('')
}

// Emit risk sections first
tableSection('❌ Tenant-leak risk (fix required)', 'tenant-leak-risk')
tableSection('⚠️ Admin bypass — manual review', 'admin-bypass-review')
tableSection('⚠️ Public — unclassified', 'public-unclassified')
tableSection('✅ RLS + role check', 'rls-role')
tableSection('✅ RLS-only', 'rls-only')
tableSection('✅ Public by design (anon publishable)', 'public-anon')
tableSection('✅ Authed, no direct DB access', 'no-db-access')

mkdirSync(join(ROOT, 'docs', 'engineering'), { recursive: true })
writeFileSync(OUT, md.join('\n'), 'utf8')
const summary = Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(', ')
console.log(`Wrote ${relative(ROOT, OUT)} — ${total} fns (${summary}).`)
