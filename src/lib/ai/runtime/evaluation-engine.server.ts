// Evaluation Engine — records quality/latency/cost/success per run.
// Downstream reports read `air_evaluations` (per-org) for scoring and rollback triggers.
export interface EvalRecord {
  organizationId: string
  runId: string
  quality?: number | null    // 0..1 — filled by feedback loops or auto-scorers
  latencyMs?: number | null
  costCents?: number | null
  success?: boolean
  retries?: number
  feedback?: Record<string, unknown>
}

export async function recordEvaluation(rec: EvalRecord): Promise<void> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  await supabaseAdmin.from('air_evaluations').insert({
    organization_id: rec.organizationId,
    run_id: rec.runId,
    quality: rec.quality ?? null,
    latency_ms: rec.latencyMs ?? null,
    cost_cents: rec.costCents ?? null,
    success: rec.success ?? true,
    retries: rec.retries ?? 0,
    feedback: (rec.feedback ?? {}) as never,
  })
}
