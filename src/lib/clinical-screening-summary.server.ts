// Optional AI narrative for a persisted screening.
//
// The deterministic engine is the source of truth; this module only produces a
// short Arabic narrative on top of the already-computed warnings. Any failure
// (missing key, provider outage, timeout) falls back to the deterministic
// summary and never blocks the clinical workflow.
//
// PII contract: the prompt contains severity/category/stable code only — no
// patient name, phone, MRN, or free-text clinical notes.

import type { ClinicalWarning } from '@/domain/clinical/types'
import type { ScreeningSnapshot } from '@/domain/clinical-screening/schemas'
import type { Actor } from './session.server'
import { getScreeningById } from './clinical-screening.server'

export interface ScreeningSummaryResult {
  summaryAr: string
  source: 'deterministic' | 'ai'
  persisted: boolean
}

function buildEvidenceLines(warnings: readonly ClinicalWarning[]): string {
  return warnings
    .slice(0, 20)
    .map((warning) => `${warning.severity}/${warning.category}/${warning.code}`)
    .join('\n')
}

async function persistSummary(
  actor: Actor,
  screeningId: string,
  summaryAr: string,
  source: 'deterministic' | 'ai',
): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types yet (ADR-0003)
    const db = supabaseAdmin as unknown as { from(table: string): any }
    const { error } = await db
      .from('hc_clinical_screenings')
      .update({ summary_ar: summaryAr, summary_source: source })
      .eq('id', screeningId)
      .eq('organization_id', actor.organizationId)
    return !error
  } catch {
    return false
  }
}

export async function summarizeScreening(args: {
  actor: Actor
  screeningId: string
}): Promise<ScreeningSummaryResult> {
  const lookup = await getScreeningById({ actor: args.actor, screeningId: args.screeningId })
  if (!lookup.data) {
    return {
      summaryAr: 'ملخص الفحص غير متاح. راجع التنبيهات الظاهرة في السجل.',
      source: 'deterministic',
      persisted: false,
    }
  }

  const screening: ScreeningSnapshot = lookup.data
  if (screening.warnings.length === 0) {
    return { summaryAr: screening.summaryAr, source: 'deterministic', persisted: false }
  }

  try {
    const { callOpenAi } = await import('./ai/provider.server')
    const result = await callOpenAi({
      model: 'gpt-4.1-mini',
      instructions:
        'أنت مساعد صيدلي. اكتب ملخصاً عربياً موجزاً (سطران كحد أقصى) للتنبيهات السريرية المعطاة. ' +
        'لا تضف تشخيصاً أو جرعة أو نصيحة دوائية جديدة، ولا تذكر أي بيانات شخصية. ' +
        'اذكر فقط ما ورد في التنبيهات.',
      input: [
        {
          role: 'user',
          content: [{ type: 'input_text', text: buildEvidenceLines(screening.warnings) }],
        },
      ],
      correlationId: args.actor.correlationId,
      maxRetries: 0,
      maxOutputTokens: 220,
      feature: 'clinical-screening',
    })

    const text = result.text.trim()
    if (!text) throw new Error('empty AI summary')

    const persisted = await persistSummary(args.actor, args.screeningId, text, 'ai')
    return { summaryAr: text, source: 'ai', persisted }
  } catch (error) {
    console.warn('[clinical-screening] AI summary unavailable, using deterministic fallback', error)
    return { summaryAr: screening.summaryAr, source: 'deterministic', persisted: false }
  }
}
