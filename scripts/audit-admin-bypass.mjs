#!/usr/bin/env node
// Wave R1.3.1 — Admin Client Elimination Audit.
//
// Reuses the R1.3 parser to enumerate every exported createServerFn, then
// classifies each `admin-bypass (gated)` function into one of four buckets:
//
//   A — Keep (legitimate bypass): must run above RLS by design.
//   B — Replace with RLS: ordinary tenant-scoped CRUD; an RLS policy can
//       enforce what the code currently enforces manually.
//   C — Service layer required: multi-table transactions, ledgers,
//       state-machines, or cross-org aggregation that RLS cannot express.
//   D — Redesign: uses supabaseAdmin without a real reason, or has the
//       auth/tenant check *after* the mutation.
//
// Emits docs/engineering/WAVE-R1.3.1-ADMIN-BYPASS-CLASSIFICATION.md.
// Static evidence only; the doc is the input to R1.3.2+ execution waves.

import { readdirSync, readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs'
import { join, relative, basename } from 'node:path'

const ROOT = process.cwd()
const SRC = join(ROOT, 'src', 'lib')
const OUT = join(ROOT, 'docs', 'engineering', 'WAVE-R1.3.1-ADMIN-BYPASS-CLASSIFICATION.md')

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

const DECL_RE = /export\s+const\s+([A-Za-z0-9_]+)\s*=\s*createServerFn\s*\(\s*\{([^}]*)\}\s*\)/g

function sliceFn(src, startIdx) {
  const next = src.slice(startIdx).search(/export\s+const\s+[A-Za-z0-9_]+\s*=\s*createServerFn\s*\(/)
  return next === -1 ? src.slice(startIdx) : src.slice(startIdx, startIdx + next)
}

// System / infrastructure tables — writes here must bypass RLS by design.
const SYSTEM_TABLES = new Set([
  'ai_events', 'ai_events_dlq', 'ai_actions', 'ai_decisions', 'ai_feedback',
  'ai_memory', 'ai_neural_memory', 'ai_neural_synaptic_log', 'ai_safety_logs',
  'ai_security_audit', 'ai_security_events', 'ai_tool_events', 'ai_world_health',
  'agent_events', 'agent_events_dlq', 'agent_runs', 'agent_actions',
  'agent_decisions', 'agent_feedback_events', 'agent_kpis',
  'agent_performance_insights', 'agent_recommendations', 'agent_weights',
  'agent_approval_requests', 'ai_agents', 'air_agents', 'air_runs',
  'air_kernel_calls', 'air_capabilities', 'air_budgets', 'air_evaluations',
  'air_memory_layers', 'air_policies', 'air_prompts',
  'audit_events', 'admin_audit_log', 'activity_logs', 'error_logs',
  'error_logs_archive', 'health_checks', 'system_incidents',
  'idempotency_keys', 'inventory_idempotency', 'rate_limit_buckets',
  'trigger_metrics', 'event_consumer_schedule_log', 'confidence_calibration_log',
  'catalog_ai_signals', 'provider_ranking_scores', 'inventory_shadow_log',
  'sun_decisions', 'sun_memory',
])

// Files whose entire surface is system/observability/AI-runtime — Bucket A default.
const SYSTEM_FILES = new Set([
  'ai.functions.ts',
  'analytics.functions.ts',
  'modules.functions.ts',
  'me.functions.ts',
])

// Files that are dominated by multi-step domain services (Bucket C default,
// unless the specific handler is a trivial read).
const SERVICE_FILES = new Set([
  'dispenses.mutations.functions.ts',
  'loyalty.mutations.functions.ts',
  'insurance.mutations.functions.ts',
  'prescriptions.mutations.functions.ts',
  'purchasing.functions.ts',
  'campaigns.mutations.functions.ts',
  'promotions.mutations.functions.ts',
  'sbdma-import.functions.ts',
])

function extractTables(body) {
  const tables = new Set()
  const writeTables = new Set()
  const re = /\.from\(\s*['"`]([a-zA-Z0-9_]+)['"`]\s*\)([^;]{0,300})/g
  let m
  while ((m = re.exec(body)) !== null) {
    tables.add(m[1])
    if (/\.(insert|update|delete|upsert)\s*\(/.test(m[2])) {
      writeTables.add(m[1])
    }
  }
  return { tables: [...tables], writeTables: [...writeTables] }
}

function classifyBucket(fn) {
  const { file, body } = fn
  const base = basename(file)
  const { tables, writeTables } = extractTables(body)

  const hasReqPerm = /requirePermission\s*\(/.test(body)
  const hasReqOrg = /requireOrg\s*\(|actor\.organizationId/.test(body)
  const hasActor = /getActor\s*\(\s*\)/.test(body)
  const usesIdempotency = /withIdempotency\s*\(/.test(body)
  const usesEngine = /engine\.server|rule-engine|runtime\/kernel|ledger|state-machine|adapters\.server/.test(body)
  const stateTransition = /status\s*:\s*['"]/.test(body) && /\.update\s*\(/.test(body)
  const isMutation = writeTables.length > 0

  // Position of first auth check vs first mutation — for Bucket D detection.
  const firstMutIdx = (() => {
    const m = body.match(/\.(insert|update|delete|upsert)\s*\(/)
    return m ? body.indexOf(m[0]) : -1
  })()
  const firstAuthIdx = (() => {
    const m = body.match(/requirePermission\s*\(|requireOrg\s*\(|requireRole\s*\(/)
    return m ? body.indexOf(m[0]) : -1
  })()
  const authAfterMut = isMutation && firstAuthIdx !== -1 && firstMutIdx !== -1 && firstAuthIdx > firstMutIdx

  const systemWrites = writeTables.some((t) => SYSTEM_TABLES.has(t))
  const systemReads = tables.some((t) => SYSTEM_TABLES.has(t))

  let bucket, rationale, followUp

  // Rule 1 — legitimate infra files.
  if (SYSTEM_FILES.has(base)) {
    bucket = 'A'
    rationale = `System/observability surface (${base}); runs above RLS by design.`
    followUp = 'Document the bypass in a header comment; no code change.'
  }
  // Rule 2 — writes to system/observability tables.
  else if (systemWrites || (!isMutation && systemReads && tables.every((t) => SYSTEM_TABLES.has(t)))) {
    bucket = 'A'
    rationale = `Touches system tables (${[...new Set([...writeTables, ...tables])].filter((t) => SYSTEM_TABLES.has(t)).join(', ')}); RLS not applicable.`
    followUp = 'Keep; add explanatory comment.'
  }
  // Rule 3 — auth after mutation → Bucket D.
  else if (authAfterMut) {
    bucket = 'D'
    rationale = 'Permission/tenant check happens *after* the mutation — order-of-operations bug.'
    followUp = 'Move auth guards to the top of the handler before any write.'
  }
  // Rule 4 — no auth guard at all on a mutation → Bucket D.
  else if (isMutation && !hasReqPerm && !hasReqOrg) {
    bucket = 'D'
    rationale = 'Mutation with neither requirePermission nor org check in this handler body.'
    followUp = 'Add explicit requirePermission + requireOrg, or delegate to a guarded helper.'
  }
  // Rule 5 — service-layer domains and multi-table / engine-backed handlers.
  else if (
    SERVICE_FILES.has(base) ||
    usesEngine ||
    usesIdempotency ||
    writeTables.length >= 2 ||
    stateTransition
  ) {
    bucket = 'C'
    const why = []
    if (SERVICE_FILES.has(base)) why.push(`domain: ${base.replace('.functions.ts', '')}`)
    if (usesEngine) why.push('delegates to engine.server')
    if (usesIdempotency) why.push('idempotent command')
    if (writeTables.length >= 2) why.push(`multi-table write (${writeTables.join(', ')})`)
    if (stateTransition) why.push('status transition')
    rationale = `Requires transactional / stateful invariant — ${why.join('; ')}.`
    followUp = 'Extract to SECURITY DEFINER RPC or src/lib/services/ layer with explicit invariants + tests.'
  }
  // Rule 6 — everything else = tenant-scoped CRUD that RLS could enforce.
  else {
    bucket = 'B'
    const target = writeTables[0] ?? tables[0] ?? '(read-only)'
    rationale = `Tenant-scoped ${isMutation ? 'CRUD' : 'read'} on \`${target}\`; org filter + role check duplicate what an RLS policy would enforce.`
    followUp = `Add RLS policy on \`${target}\` scoped to \`organization_id = current_org()\`, then migrate handler to context.supabase.`
  }

  return { bucket, rationale, followUp, tables, writeTables, hasReqPerm, hasReqOrg, hasActor }
}

function parseFile(file) {
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
    const usesContextSb = /\bcontext\.supabase\b/.test(body)
    const usesAdmin = /\bsupabaseAdmin\b|client\.server/.test(body)
    const dataMode = usesAdmin && !usesContextSb ? 'admin-bypass'
      : usesContextSb && !usesAdmin ? 'rls'
      : usesAdmin && usesContextSb ? 'mixed'
      : 'other'

    // R1.3.1 scope = admin-bypass (authed OR not — includes the 1 tenant-leak).
    if (dataMode !== 'admin-bypass') continue
    fns.push({ file, name, method, body, authed, middlewareAuth, actorAuth })
  }
  return fns
}

// Domain clusters for reporting.
const CLUSTERS = [
  { key: 'crm', label: 'CRM cluster', files: ['customers.functions.ts', 'customers.mutations.functions.ts', 'loyalty.functions.ts', 'loyalty.mutations.functions.ts', 'promotions.functions.ts', 'promotions.mutations.functions.ts', 'campaigns.functions.ts', 'campaigns.mutations.functions.ts'] },
  { key: 'medical', label: 'Medical cluster', files: ['patients.functions.ts', 'patients.mutations.functions.ts', 'doctors.functions.ts', 'doctors.mutations.functions.ts', 'prescriptions.functions.ts', 'prescriptions.mutations.functions.ts', 'dispenses.functions.ts', 'dispenses.mutations.functions.ts', 'insurance.functions.ts', 'insurance.mutations.functions.ts', 'clinical.functions.ts'] },
  { key: 'supply', label: 'Supply cluster', files: ['catalog.functions.ts', 'catalog.mutations.functions.ts', 'inventory.functions.ts', 'inventory.mutations.functions.ts', 'suppliers.functions.ts', 'suppliers.mutations.functions.ts', 'purchasing.functions.ts', 'sbdma-import.functions.ts'] },
  { key: 'platform', label: 'Platform cluster', files: ['ai.functions.ts', 'analytics.functions.ts', 'medical-directory.functions.ts', 'me.functions.ts', 'modules.functions.ts', 'cart.functions.ts', 'cosmic-search.functions.ts'] },
]

function clusterOf(base) {
  for (const c of CLUSTERS) if (c.files.includes(base)) return c.key
  return 'other'
}

const files = walk(SRC).sort()
const all = []
for (const f of files) {
  for (const fn of parseFile(f)) {
    const cls = classifyBucket(fn)
    all.push({ ...fn, ...cls, cluster: clusterOf(basename(fn.file)) })
  }
}

const counts = { A: 0, B: 0, C: 0, D: 0 }
for (const r of all) counts[r.bucket] += 1

// Emit doc.
const md = []
md.push('# Wave R1.3.1 — Admin Client Elimination Audit')
md.push('')
md.push(`Generated: ${new Date().toISOString()}`)
md.push('')
md.push('Auto-generated by `node scripts/audit-admin-bypass.mjs`. Extends')
md.push('`WAVE-R1.3-AUTHZ-AUDIT.md` by classifying every `admin-bypass` handler')
md.push('into one of four action buckets. **Read-only wave** — no code, RLS, or')
md.push('migration changes are executed here.')
md.push('')
md.push('## Executive summary')
md.push('')
md.push(`- Handlers scanned (admin-bypass verdict from R1.3): **${all.length}**`)
md.push('')
md.push('| Bucket | Meaning | Count |')
md.push('|---|---|---:|')
md.push(`| **A** | Legitimate System Operations (keep) | ${counts.A} |`)
md.push(`| **B** | Replace with RLS | ${counts.B} |`)
md.push(`| **C** | Service Layer Required | ${counts.C} |`)
md.push(`| **D** | Needs Redesign | ${counts.D} |`)
md.push('')
md.push('```text')
md.push(`Legitimate System Operations   ${String(counts.A).padStart(2)}`)
md.push(`Replace with RLS               ${String(counts.B).padStart(2)}`)
md.push(`Service Layer Required         ${String(counts.C).padStart(2)}`)
md.push(`Needs Redesign                 ${String(counts.D).padStart(2)}`)
md.push('```')
md.push('')
md.push('## Bucket definitions')
md.push('')
md.push('- **A — Keep (legitimate bypass).** Must run above RLS by design:')
md.push('  observability writes, AI runtime tables, cron/queue workers,')
md.push('  audit-log writers, session bootstrap. Action: document, do not change.')
md.push('- **B — Replace with RLS.** Ordinary tenant-scoped CRUD. The current')
md.push('  `requirePermission` + `actor.organizationId` guard duplicates what a')
md.push('  scoped RLS policy would enforce. Action (R1.3.3): write policy,')
md.push('  migrate handler to `context.supabase`.')
md.push('- **C — Service layer required.** Multi-table transactions, ledgers,')
md.push('  state-machines, engine-backed workflows. RLS alone cannot express the')
md.push('  invariant. Action (R1.3.4): extract to a `SECURITY DEFINER` RPC or')
md.push('  an explicit `src/lib/services/` layer with tests around the invariant.')
md.push('- **D — Redesign.** Auth/tenant check missing or executed *after* the')
md.push('  mutation. Action (R1.3.5): fix order-of-operations or add guards')
md.push('  before shipping any further work in that handler.')
md.push('')
md.push('## Classification method')
md.push('')
md.push('Applied to each admin-bypass handler in this priority order:')
md.push('')
md.push('1. File is a pure system/observability surface (`ai.functions.ts`,')
md.push('   `analytics.functions.ts`, `me.functions.ts`, `modules.functions.ts`) → **A**.')
md.push('2. Handler writes to a system/observability table (`ai_events`, `agent_runs`,')
md.push('   `audit_events`, `error_logs`, `air_*`, `inventory_idempotency`, etc.) → **A**.')
md.push('3. Handler mutates but the first `requirePermission`/`requireOrg` appears')
md.push('   *after* the first `.insert`/`.update`/`.delete`/`.upsert` → **D**.')
md.push('4. Handler mutates but no `requirePermission` and no org check appear → **D**.')
md.push('5. File is a domain-service surface (dispenses/loyalty/insurance/')
md.push('   prescriptions/purchasing/campaigns/promotions mutations, sbdma-import),')
md.push('   OR handler delegates to `engine.server`/`rule-engine`/`runtime/kernel`/')
md.push('   `adapters.server`, OR uses `withIdempotency`, OR writes to ≥2 tables,')
md.push('   OR performs a status transition → **C**.')
md.push('6. Everything else = tenant-scoped CRUD that RLS could enforce → **B**.')
md.push('')

function renderCluster(cluster) {
  const rows = all.filter((r) => r.cluster === cluster.key)
  if (!rows.length) return
  md.push(`## ${cluster.label} — ${rows.length}`)
  md.push('')
  md.push('| File | Function | Bucket | Write tables | Read tables | Perm | Org | Rationale | Follow-up |')
  md.push('|---|---|:---:|---|---|:---:|:---:|---|---|')
  for (const r of rows) {
    const rel = relative(ROOT, r.file)
    const w = r.writeTables.length ? r.writeTables.join(', ') : '—'
    const rd = r.tables.filter((t) => !r.writeTables.includes(t)).join(', ') || '—'
    md.push(`| \`${rel}\` | \`${r.name}\` | **${r.bucket}** | ${w} | ${rd} | ${r.hasReqPerm ? '✅' : '—'} | ${r.hasReqOrg ? '✅' : '—'} | ${r.rationale} | ${r.followUp} |`)
  }
  md.push('')
}
for (const c of CLUSTERS) renderCluster(c)

const others = all.filter((r) => r.cluster === 'other')
if (others.length) {
  md.push(`## Other — ${others.length}`)
  md.push('')
  md.push('| File | Function | Bucket | Rationale |')
  md.push('|---|---|:---:|---|')
  for (const r of others) md.push(`| \`${relative(ROOT, r.file)}\` | \`${r.name}\` | **${r.bucket}** | ${r.rationale} |`)
  md.push('')
}

md.push('## Follow-up backlog (sequenced, not executed here)')
md.push('')
md.push('- **R1.3.2 — RLS policy migration.** For every Bucket B row, write the')
md.push('  missing tenant-scoped SELECT/INSERT/UPDATE/DELETE policies on the')
md.push('  target table. Ship as one migration per domain cluster.')
md.push('- **R1.3.3 — Bucket B handler migration.** After R1.3.2 lands, migrate')
md.push('  each Bucket B handler from `supabaseAdmin` to `context.supabase` +')
md.push('  `requireSupabaseAuth`. Keep the existing `requirePermission` as a')
md.push('  defence-in-depth layer; RLS becomes the enforcement plane.')
md.push('- **R1.3.4 — Bucket C service extraction.** For every Bucket C row,')
md.push('  choose either a `SECURITY DEFINER` RPC (when the invariant fits SQL)')
md.push('  or an explicit `src/lib/services/<domain>-service.server.ts` module')
md.push('  with unit tests around the invariant.')
md.push('- **R1.3.5 — Bucket D repair.** Fix the order-of-operations / missing-')
md.push('  guard issue in the flagged handlers before any other work on that')
md.push('  domain.')
md.push('- **R1.4 — Server function contract audit.** Zod coverage, error taxonomy,')
md.push('  correlation IDs, pagination, idempotency, timeouts. Queued.')
md.push('- **R1.5 — Domain boundary audit.** Import graphs, circular deps,')
md.push('  domain leakage. Queued.')
md.push('- **R1.6 — Secrets & configuration audit.** `VITE_*` leakage check,')
md.push('  boot-time secret presence assertions. Queued.')
md.push('')
md.push('## Non-goals (explicit)')
md.push('')
md.push('- No migrations run in this wave.')
md.push('- No handler rewrites.')
md.push('- No changes to `session.server.ts`, `idempotency.server.ts`, or the')
md.push('  `_authenticated/` route gate.')
md.push('- Tracks B/C (WhatsApp/Meta) remain gated on Lovable Secrets.')

mkdirSync(join(ROOT, 'docs', 'engineering'), { recursive: true })
writeFileSync(OUT, md.join('\n'), 'utf8')
console.log(`Wrote ${relative(ROOT, OUT)} — ${all.length} admin-bypass fns (A=${counts.A}, B=${counts.B}, C=${counts.C}, D=${counts.D}).`)
