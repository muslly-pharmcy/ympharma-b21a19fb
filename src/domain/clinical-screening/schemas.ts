// Clinical screening domain — client-safe types and pure helpers.
//
// A screening is the persisted evidence behind a clinical decision made during
// prescription approval or dispensing. It is advisory except for `critical`
// findings, which require a recorded override (see migration
// 20261024090000_clinical_screening.sql).
//
// Nothing here talks to the database or the network; server-only code lives in
// `src/lib/clinical-screening.server.ts`.

import { z } from 'zod'
import type { ClinicalSeverity, ClinicalWarning } from '@/domain/clinical/types'

export const SCREENING_FLOWS = ['dispense', 'prescription_approval'] as const
export type ScreeningFlow = (typeof SCREENING_FLOWS)[number]

export const SCREENING_CONFIDENCES = ['verified', 'partial', 'unverified'] as const
export type ScreeningConfidence = (typeof SCREENING_CONFIDENCES)[number]

export const SUMMARY_SOURCES = ['deterministic', 'ai'] as const
export type SummarySource = (typeof SUMMARY_SOURCES)[number]

export interface ScreeningOverride {
  reason: string
  by: string | null
  at: string | null
}

export interface ScreeningSnapshot {
  id: string
  organizationId: string
  branchId: string | null
  dispenseId: string | null
  prescriptionId: string
  patientId: string
  flow: ScreeningFlow
  providerId: string
  providerName: string
  confidence: ScreeningConfidence
  highestSeverity: ClinicalSeverity | null
  warningCount: number
  warnings: ClinicalWarning[]
  inputHash: string
  summaryAr: string
  summarySource: SummarySource
  ranAt: string
  override: ScreeningOverride | null
  correlationId: string | null
}

export const SEVERITY_RANK: Record<ClinicalSeverity, number> = {
  critical: 0,
  high: 1,
  moderate: 2,
  low: 3,
  info: 4,
}

export const SEVERITY_LABEL_AR: Record<ClinicalSeverity, string> = {
  critical: 'حرج — يتطلب مراجعة صيدلي',
  high: 'مرتفع',
  moderate: 'متوسط',
  low: 'منخفض',
  info: 'معلومة',
}

export const CONFIDENCE_LABEL_AR: Record<ScreeningConfidence, string> = {
  verified: 'موثوق — مزوّد معرفة مفعّل',
  partial: 'جزئي — ملف المريض غير مكتمل',
  unverified: 'غير موثوق — لا يوجد مزوّد معرفة',
}

/** Highest severity present, or null when the screening produced no warnings. */
export function highestSeverity(warnings: readonly ClinicalWarning[]): ClinicalSeverity | null {
  let best: ClinicalSeverity | null = null
  for (const warning of warnings) {
    if (best === null || SEVERITY_RANK[warning.severity] < SEVERITY_RANK[best]) {
      best = warning.severity
    }
  }
  return best
}

/**
 * Confidence is a property of the knowledge source plus patient-data
 * completeness — never of the AI narrative.
 */
export function confidenceFor(
  providerId: string,
  context: { hasPatientProfile: boolean },
): ScreeningConfidence {
  if (!providerId || providerId === 'null') return 'unverified'
  return context.hasPatientProfile ? 'verified' : 'partial'
}

/** Deterministic Arabic summary used whenever AI is unavailable or disabled. */
export function deterministicSummaryAr(warnings: readonly ClinicalWarning[]): string {
  if (warnings.length === 0) {
    return 'لم تُرصد تفاعلات أو حساسية معروفة ضمن قاعدة المعرفة الحالية. تبقى المراجعة الصيدلية مطلوبة.'
  }
  const counts = new Map<string, number>()
  for (const warning of warnings) {
    counts.set(warning.severity, (counts.get(warning.severity) ?? 0) + 1)
  }
  const order: ClinicalSeverity[] = ['critical', 'high', 'moderate', 'low', 'info']
  const parts = order
    .filter((severity) => counts.has(severity))
    .map((severity) => `${counts.get(severity)} ${SEVERITY_LABEL_AR[severity]}`)
  return `تم رصد ${warnings.length} تنبيهاً سريرياً (${parts.join('، ')}). راجع التفاصيل قبل الصرف.`
}

/**
 * Stable, order-sensitive hash of the screened drug set. The database uses it
 * to make screening idempotent per dispense/prescription input.
 */
export function screeningInputHash(
  items: ReadonlyArray<{ name: string; dose?: string | null; route?: string | null; qty?: number | null }>,
): string {
  const canonical = items
    .map((item) =>
      [item.name.trim().toLowerCase(), item.dose ?? '', item.route ?? '', item.qty ?? ''].join('|'),
    )
    .join(';')
  // FNV-1a 32-bit, hex encoded; stable across runtimes and cheap.
  let hash = 0x811c9dc5
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `fnv1a-${hash.toString(16).padStart(8, '0')}-${canonical.length}`
}

export const dispenseIdInput = z.object({ dispenseId: z.string().uuid() })

export const screenDispenseInput = z.object({
  dispenseId: z.string().uuid(),
  correlationId: z.string().min(4).max(128).optional(),
})

export const screeningIdInput = z.object({ screeningId: z.string().uuid() })

export const overrideScreeningInput = z.object({
  dispenseId: z.string().uuid(),
  screeningId: z.string().uuid(),
  reason: z.string().trim().min(10).max(500),
  acknowledge: z.literal(true),
})
