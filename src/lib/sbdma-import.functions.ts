import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

/**
 * SBDMA Import Decision Engine
 *
 * Two-phase, auditable price import:
 *   1) analyzeSbdmaImport → dry run, classifies each row into
 *      matched / new / ambiguous / invalid and stores a job + rows.
 *   2) commitSbdmaImport → applies only MATCHED (update) and NEW (insert)
 *      rows. AMBIGUOUS/INVALID stay flagged for manual review.
 *
 * Primary key strategy: barcode. Fallback: normalized name + manufacturer
 * (+ optional strength). Anything with multiple candidates is AMBIGUOUS,
 * never a silent merge.
 */

export type SbdmaInputRow = {
  barcode?: string | null
  name_ar?: string | null
  name_en?: string | null
  manufacturer?: string | null
  manufacturer_country?: string | null
  strength?: string | null
  dosage_form?: string | null
  agent_name?: string | null
  sbdma_official_price?: number | null
  requires_prescription?: boolean | null
}

export type ImportDecision = 'matched' | 'new' | 'ambiguous' | 'invalid'

export type ImportJobSummary = {
  id: string
  source_name: string
  status: string
  dry_run: boolean
  total_rows: number
  matched_count: number
  new_count: number
  ambiguous_count: number
  invalid_count: number
  error: string | null
  committed_at: string | null
  created_at: string
}

export type ImportRowDetail = {
  id: string
  row_index: number
  decision: ImportDecision
  payload: SbdmaInputRow
  matched_product_id: string | null
  candidate_ids: string[]
  confidence: number | null
  reason: string | null
  applied: boolean
}

function normalize(s: string | null | undefined): string {
  return (s ?? '')
    .toString()
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, '') // strip Arabic diacritics
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeRow(r: SbdmaInputRow): SbdmaInputRow {
  return {
    barcode: r.barcode?.toString().trim() || null,
    name_ar: r.name_ar?.toString().trim() || null,
    name_en: r.name_en?.toString().trim() || null,
    manufacturer: r.manufacturer?.toString().trim() || null,
    manufacturer_country: r.manufacturer_country?.toString().trim() || null,
    strength: r.strength?.toString().trim() || null,
    dosage_form: r.dosage_form?.toString().trim() || null,
    agent_name: r.agent_name?.toString().trim() || null,
    sbdma_official_price:
      r.sbdma_official_price != null && Number.isFinite(Number(r.sbdma_official_price))
        ? Number(r.sbdma_official_price)
        : null,
    requires_prescription:
      typeof r.requires_prescription === 'boolean' ? r.requires_prescription : null,
  }
}

async function assertAdmin(supabase: unknown, userId: string): Promise<void> {
  const client = supabase as {
    rpc: (fn: 'has_role', args: { _user_id: string; _role: 'admin' }) => Promise<{
      data: boolean | null
      error: { message: string } | null
    }>
  }
  const { data, error } = await client.rpc('has_role', {
    _user_id: userId,
    _role: 'admin',
  })
  if (error || !data) throw new Error('Forbidden: admin role required')
}

// ─── ANALYZE (Dry Run) ─────────────────────────────────────────────────────

export const analyzeSbdmaImport = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown): { source_name: string; rows: SbdmaInputRow[] } => {
    const v = (raw ?? {}) as { source_name?: string; rows?: SbdmaInputRow[] }
    const source_name = (v.source_name ?? '').toString().trim().slice(0, 200) || 'sbdma-upload'
    const rows = Array.isArray(v.rows) ? v.rows.slice(0, 5000) : []
    if (rows.length === 0) throw new Error('rows required')
    return { source_name, rows }
  })
  .handler(async ({ data, context }): Promise<{ job_id: string; summary: ImportJobSummary }> => {
    await assertAdmin(context.supabase, context.userId)

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    // Create job
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('catalog_import_jobs')
      .insert({
        source_name: data.source_name,
        uploaded_by: context.userId,
        dry_run: true,
        status: 'analyzing',
        total_rows: data.rows.length,
      })
      .select('*')
      .single()
    if (jobErr || !job) throw new Error(jobErr?.message ?? 'failed to create job')

    let matched = 0,
      created = 0,
      ambiguous = 0,
      invalid = 0
    const rowInserts: Array<Record<string, unknown>> = []

    for (let i = 0; i < data.rows.length; i++) {
      const raw = normalizeRow(data.rows[i]!)

      // 1) Validity gate
      if (!raw.name_ar || raw.sbdma_official_price == null) {
        invalid++
        rowInserts.push({
          job_id: job.id,
          row_index: i,
          payload: raw,
          decision: 'invalid',
          reason: 'name_ar و sbdma_official_price مطلوبان',
        })
        continue
      }

      // 2) Barcode-first lookup
      if (raw.barcode) {
        const { data: byBarcode } = await supabaseAdmin
          .from('catalog_products')
          .select('id')
          .eq('barcode', raw.barcode)
          .limit(2)
        const hits = byBarcode ?? []
        if (hits.length === 1) {
          matched++
          rowInserts.push({
            job_id: job.id,
            row_index: i,
            payload: raw,
            decision: 'matched',
            matched_product_id: hits[0]!.id,
            confidence: 1.0,
            reason: 'exact barcode',
          })
          continue
        }
        if (hits.length > 1) {
          ambiguous++
          rowInserts.push({
            job_id: job.id,
            row_index: i,
            payload: raw,
            decision: 'ambiguous',
            candidate_ids: hits.map((h) => h.id),
            confidence: 0.6,
            reason: 'barcode مكرر في الكتالوج — راجع يدوياً',
          })
          continue
        }
        // no barcode hit → fall through to NEW
        created++
        rowInserts.push({
          job_id: job.id,
          row_index: i,
          payload: raw,
          decision: 'new',
          confidence: 0.95,
          reason: 'barcode غير موجود — إنشاء سجل جديد',
        })
        continue
      }

      // 3) Name + manufacturer fallback
      const normName = normalize(raw.name_ar)
      const normMfr = normalize(raw.manufacturer)
      if (normName.length < 3) {
        invalid++
        rowInserts.push({
          job_id: job.id,
          row_index: i,
          payload: raw,
          decision: 'invalid',
          reason: 'الاسم قصير جداً للمطابقة الآمنة',
        })
        continue
      }

      let q = supabaseAdmin
        .from('catalog_products')
        .select('id, name_ar, manufacturer, strength')
        .ilike('name_ar', `%${raw.name_ar}%`)
        .limit(10)
      if (raw.manufacturer) q = q.ilike('manufacturer', `%${raw.manufacturer}%`)
      const { data: candidates } = await q
      const filtered = (candidates ?? []).filter((c) => {
        const cn = normalize(c.name_ar)
        const cm = normalize(c.manufacturer)
        const nameOk = cn === normName || cn.includes(normName) || normName.includes(cn)
        const mfrOk = !normMfr || cm === normMfr || cm.includes(normMfr)
        return nameOk && mfrOk
      })

      if (filtered.length === 0) {
        created++
        rowInserts.push({
          job_id: job.id,
          row_index: i,
          payload: raw,
          decision: 'new',
          confidence: 0.7,
          reason: 'لا يوجد تطابق — سيتم إنشاء سجل جديد',
        })
      } else if (filtered.length === 1) {
        matched++
        rowInserts.push({
          job_id: job.id,
          row_index: i,
          payload: raw,
          decision: 'matched',
          matched_product_id: filtered[0]!.id,
          confidence: 0.85,
          reason: 'تطابق اسم + شركة',
        })
      } else {
        ambiguous++
        rowInserts.push({
          job_id: job.id,
          row_index: i,
          payload: raw,
          decision: 'ambiguous',
          candidate_ids: filtered.map((f) => f.id),
          confidence: 0.5,
          reason: `${filtered.length} مرشحين — يحتاج مراجعة يدوية`,
        })
      }
    }

    // Bulk insert rows in chunks (Postgres row limit friendly)
    const CHUNK = 500
    for (let i = 0; i < rowInserts.length; i += CHUNK) {
      const { error } = await supabaseAdmin
        .from('catalog_import_rows')
        .insert(rowInserts.slice(i, i + CHUNK) as never)
      if (error) throw new Error(`row insert failed: ${error.message}`)
    }

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('catalog_import_jobs')
      .update({
        status: 'analyzed',
        matched_count: matched,
        new_count: created,
        ambiguous_count: ambiguous,
        invalid_count: invalid,
      })
      .eq('id', job.id)
      .select('*')
      .single()
    if (updErr || !updated) throw new Error(updErr?.message ?? 'failed to finalize job')

    return { job_id: job.id, summary: updated as ImportJobSummary }
  })

// ─── COMMIT ─────────────────────────────────────────────────────────────────

export const commitSbdmaImport = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown): { job_id: string } => {
    const v = (raw ?? {}) as { job_id?: string }
    if (!v.job_id) throw new Error('job_id required')
    return { job_id: v.job_id }
  })
  .handler(async ({ data, context }): Promise<{ summary: ImportJobSummary }> => {
    await assertAdmin(context.supabase, context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    const { data: job, error: jobErr } = await supabaseAdmin
      .from('catalog_import_jobs')
      .select('*')
      .eq('id', data.job_id)
      .single()
    if (jobErr || !job) throw new Error('job not found')
    if (job.status === 'committed') throw new Error('job already committed')

    await supabaseAdmin
      .from('catalog_import_jobs')
      .update({ status: 'committing' })
      .eq('id', data.job_id)

    // Fetch actionable rows
    const { data: rows, error: rowsErr } = await supabaseAdmin
      .from('catalog_import_rows')
      .select('*')
      .eq('job_id', data.job_id)
      .in('decision', ['matched', 'new'])
      .eq('applied', false)
    if (rowsErr) throw new Error(rowsErr.message)

    let appliedUpdates = 0
    let appliedInserts = 0
    let failures = 0
    const failureMsgs: string[] = []

    for (const row of rows ?? []) {
      const payload = row.payload as SbdmaInputRow
      try {
        if (row.decision === 'matched' && row.matched_product_id) {
          const update: Record<string, unknown> = {
            sbdma_official_price: payload.sbdma_official_price,
          }
          if (payload.agent_name) update.agent_name = payload.agent_name
          if (payload.manufacturer_country)
            update.manufacturer_country = payload.manufacturer_country
          if (payload.requires_prescription != null)
            update.requires_prescription = payload.requires_prescription
          const { error } = await supabaseAdmin
            .from('catalog_products')
            .update(update as never)
            .eq('id', row.matched_product_id)
          if (error) throw new Error(error.message)
          appliedUpdates++
        } else if (row.decision === 'new') {
          const insert: Record<string, unknown> = {
            name_ar: payload.name_ar,
            name_en: payload.name_en,
            manufacturer: payload.manufacturer,
            manufacturer_country: payload.manufacturer_country,
            strength: payload.strength,
            dosage_form: payload.dosage_form,
            barcode: payload.barcode,
            agent_name: payload.agent_name,
            sbdma_official_price: payload.sbdma_official_price,
            requires_prescription: payload.requires_prescription ?? false,
            status: 'approved',
            is_public: true,
            created_by: context.userId,
          }
          const { error } = await supabaseAdmin.from('catalog_products').insert(insert as never)
          if (error) throw new Error(error.message)
          appliedInserts++
        }
        await supabaseAdmin
          .from('catalog_import_rows')
          .update({ applied: true })
          .eq('id', row.id)
      } catch (e) {
        failures++
        const msg = e instanceof Error ? e.message : String(e)
        failureMsgs.push(`row #${row.row_index}: ${msg}`)
        await supabaseAdmin
          .from('catalog_import_rows')
          .update({ reason: `فشل التطبيق: ${msg}` })
          .eq('id', row.id)
      }
    }

    const finalStatus = failures > 0 && appliedUpdates + appliedInserts === 0 ? 'failed' : 'committed'
    const errorText = failures > 0 ? failureMsgs.slice(0, 20).join('\n') : null

    const { data: finalJob, error: finalErr } = await supabaseAdmin
      .from('catalog_import_jobs')
      .update({
        status: finalStatus,
        dry_run: false,
        committed_at: new Date().toISOString(),
        error: errorText,
      })
      .eq('id', data.job_id)
      .select('*')
      .single()
    if (finalErr || !finalJob) throw new Error(finalErr?.message ?? 'failed to close job')

    return { summary: finalJob as ImportJobSummary }
  })

// ─── QUERIES ────────────────────────────────────────────────────────────────

export const listSbdmaImportJobs = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ImportJobSummary[]> => {
    await assertAdmin(context.supabase, context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data, error } = await supabaseAdmin
      .from('catalog_import_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw new Error(error.message)
    return (data ?? []) as ImportJobSummary[]
  })

export const getSbdmaImportJob = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown): { job_id: string } => {
    const v = (raw ?? {}) as { job_id?: string }
    if (!v.job_id) throw new Error('job_id required')
    return { job_id: v.job_id }
  })
  .handler(
    async ({
      data,
      context,
    }): Promise<{ summary: ImportJobSummary; rows: ImportRowDetail[] }> => {
      await assertAdmin(context.supabase, context.userId)
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
      const [{ data: summary, error: sErr }, { data: rows, error: rErr }] = await Promise.all([
        supabaseAdmin.from('catalog_import_jobs').select('*').eq('id', data.job_id).single(),
        supabaseAdmin
          .from('catalog_import_rows')
          .select('*')
          .eq('job_id', data.job_id)
          .order('row_index'),
      ])
      if (sErr || !summary) throw new Error('job not found')
      if (rErr) throw new Error(rErr.message)
      return {
        summary: summary as ImportJobSummary,
        rows: (rows ?? []) as unknown as ImportRowDetail[],
      }
    },
  )
