// Clinical screening service — loads patient/dispense context, runs the
// advisory clinical engine, and persists the evidence row.
//
// Server-only. The browser never imports this module directly; it reaches it
// through `src/lib/clinical-screening.functions.ts`.
//
// Failure contract: every exported function returns a `ScreeningOutcome`
// (`{ data }` or `{ error }`) instead of throwing, so advisory call sites can
// ignore failures. The server-function boundary decides which errors surface.

import type { ClinicalCheckInput, ClinicalDrugRef, ClinicalPatientContext, ClinicalWarning } from '@/domain/clinical/types'
import {
  confidenceFor,
  deterministicSummaryAr,
  highestSeverity,
  screeningInputHash,
  type ScreeningConfidence,
  type ScreeningFlow,
  type ScreeningSnapshot,
  type SummarySource,
} from '@/domain/clinical-screening/schemas'
import type { Actor } from './session.server'

export const CLINICAL_SCREENING_FLAG = 'enable_clinical_inspector'

export type ScreeningFailureCode =
  | 'feature_disabled'
  | 'forbidden'
  | 'not_found'
  | 'load_failed'
  | 'screening_failed'
  | 'no_override_required'

export interface ScreeningFailure {
  code: ScreeningFailureCode
  message: string
}

export type ScreeningOutcome =
  | { data: ScreeningSnapshot; error: null }
  | { data: null; error: ScreeningFailure }

export type ScreeningLookup = {
  data: ScreeningSnapshot | null
  error: ScreeningFailure | null
}

/* eslint-disable @typescript-eslint/no-explicit-any -- `hc_clinical_screenings`
   is not yet in the generated Supabase types (no CLI/live link in this
   checkout). The untyped handle is confined to this module; see ADR-0003. */
type UntypedDb = { from(table: string): any }
/* eslint-enable @typescript-eslint/no-explicit-any */

interface DbError {
  message: string
  code?: string
}

async function database(): Promise<UntypedDb> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  return supabaseAdmin as unknown as UntypedDb
}

function failure(code: ScreeningFailureCode, message: string): ScreeningOutcome {
  return { data: null, error: { code, message } }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asWarnings(value: unknown): ClinicalWarning[] {
  return Array.isArray(value) ? (value as ClinicalWarning[]) : []
}

function toSnapshot(row: Record<string, unknown>): ScreeningSnapshot {
  const overrideReason = asNullableString(row['override_reason'])
  return {
    id: asString(row['id']),
    organizationId: asString(row['organization_id']),
    branchId: asNullableString(row['branch_id']),
    dispenseId: asNullableString(row['dispense_id']),
    prescriptionId: asString(row['prescription_id']),
    patientId: asString(row['patient_id']),
    flow: asString(row['flow'], 'dispense') as ScreeningFlow,
    providerId: asString(row['provider_id'], 'null'),
    providerName: asString(row['provider_name'], '—'),
    confidence: asString(row['confidence'], 'unverified') as ScreeningConfidence,
    highestSeverity: asNullableString(row['highest_severity']) as ClinicalWarning['severity'] | null,
    warningCount: asNumber(row['warning_count']),
    warnings: asWarnings(row['warnings']),
    inputHash: asString(row['input_hash']),
    summaryAr: asString(row['summary_ar']),
    summarySource: asString(row['summary_source'], 'deterministic') as SummarySource,
    ranAt: asString(row['ran_at']),
    override: overrideReason
      ? {
          reason: overrideReason,
          by: asNullableString(row['overridden_by']),
          at: asNullableString(row['overridden_at']),
        }
      : null,
    correlationId: asNullableString(row['correlation_id']),
  }
}

type FeatureState = 'on' | 'off' | 'error'

/**
 * Resolve the screening feature flag. An unreadable flag is an error (the
 * dispense gate then fails closed); a missing row keeps the product default
 * (`true`, matching `useFeatureFlags` and the control-tower seed).
 */
async function featureState(db: UntypedDb): Promise<FeatureState> {
  try {
    const { data, error } = await db
      .from('app_settings')
      .select('value')
      .eq('key', CLINICAL_SCREENING_FLAG)
      .maybeSingle()
    if (error) return 'error'
    const row = data as { value?: unknown } | null
    if (!row) return 'on'
    return row.value === false || row.value === 'false' ? 'off' : 'on'
  } catch {
    return 'error'
  }
}

function ageInYears(dateOfBirth: unknown): number | null {
  if (typeof dateOfBirth !== 'string' || !dateOfBirth) return null
  const born = new Date(dateOfBirth).getTime()
  if (!Number.isFinite(born)) return null
  return Math.max(0, Math.floor((Date.now() - born) / 31_557_600_000))
}

function sexOf(value: unknown): ClinicalPatientContext['sex'] {
  return value === 'male' || value === 'female' || value === 'other' ? value : null
}

async function loadPatientContext(
  db: UntypedDb,
  patientId: string,
): Promise<{ context: ClinicalPatientContext; hasProfile: boolean }> {
  const [{ data: patient }, { data: allergies }, { data: conditions }] = await Promise.all([
    db.from('hc_patients').select('id, date_of_birth, gender').eq('id', patientId).maybeSingle(),
    db.from('patient_allergies').select('allergen, severity').eq('patient_id', patientId),
    db
      .from('patient_conditions')
      .select('condition_name, icd10, status')
      .eq('patient_id', patientId),
  ])

  const allergyRows = (allergies ?? []) as Array<{ allergen?: string; severity?: string | null }>
  const conditionRows = (conditions ?? []) as Array<{
    condition_name?: string
    icd10?: string | null
    status?: string | null
  }>
  const activeConditions = conditionRows.filter(
    (row) => row.status !== 'resolved' && typeof row.condition_name === 'string',
  )

  const context: ClinicalPatientContext = {
    patientId,
    ageYears: ageInYears((patient as { date_of_birth?: unknown } | null)?.date_of_birth),
    sex: sexOf((patient as { gender?: unknown } | null)?.gender),
    weightKg: null,
    pregnant: null,
    breastfeeding: null,
    renalFunctionEgfr: null,
    hepaticImpairment: null,
    knownAllergies: allergyRows
      .filter((row) => typeof row.allergen === 'string')
      .map((row) => ({ substance: row.allergen as string, code: null })),
    activeConditions: activeConditions.map((row) => ({
      label: row.condition_name as string,
      code: row.icd10 ?? null,
    })),
  }

  return {
    context,
    hasProfile: context.knownAllergies.length > 0 || context.activeConditions.length > 0,
  }
}

interface DispenseRow {
  id: string
  organization_id: string
  branch_id: string | null
  prescription_id: string
  patient_id: string
}

interface PrescriptionRow {
  id: string
  organization_id: string
  branch_id: string | null
  patient_id: string
}

async function loadDispense(db: UntypedDb, dispenseId: string): Promise<DispenseRow | null> {
  const { data, error } = await db
    .from('hc_dispenses')
    .select('id, organization_id, branch_id, prescription_id, patient_id')
    .eq('id', dispenseId)
    .maybeSingle()
  if (error) throw new Error((error as DbError).message)
  return (data as DispenseRow | null) ?? null
}

async function loadPrescription(
  db: UntypedDb,
  prescriptionId: string,
): Promise<PrescriptionRow | null> {
  const { data, error } = await db
    .from('hc_prescriptions')
    .select('id, organization_id, branch_id, patient_id')
    .eq('id', prescriptionId)
    .maybeSingle()
  if (error) throw new Error((error as DbError).message)
  return (data as PrescriptionRow | null) ?? null
}

interface PrescriptionItemRow {
  id: string
  product_id: string | null
  medication_name: string
  dose: string | null
  frequency: string | null
  route: string | null
}

async function loadDispenseDrugs(
  db: UntypedDb,
  dispenseId: string,
  prescriptionId: string,
): Promise<ClinicalDrugRef[]> {
  const [{ data: dispenseItems }, { data: prescriptionItems }] = await Promise.all([
    db
      .from('hc_dispense_items')
      .select('id, prescription_item_id, product_id, medication_name, qty_requested')
      .eq('dispense_id', dispenseId),
    db
      .from('hc_prescription_items')
      .select('id, product_id, medication_name, dose, frequency, route')
      .eq('prescription_id', prescriptionId),
  ])

  const byId = new Map<string, PrescriptionItemRow>()
  for (const item of (prescriptionItems ?? []) as PrescriptionItemRow[]) byId.set(item.id, item)

  return ((dispenseItems ?? []) as Array<{
    id: string
    prescription_item_id: string | null
    product_id: string | null
    medication_name: string
    qty_requested: number
  }>).map((item) => {
    const source = item.prescription_item_id ? byId.get(item.prescription_item_id) : undefined
    return {
      itemId: item.id,
      productId: item.product_id,
      code: null,
      name: item.medication_name,
      dose: source?.dose ?? null,
      frequency: source?.frequency ?? null,
      route: source?.route ?? null,
    }
  })
}

async function loadPrescriptionDrugs(
  db: UntypedDb,
  prescriptionId: string,
): Promise<ClinicalDrugRef[]> {
  const { data } = await db
    .from('hc_prescription_items')
    .select('id, product_id, medication_name, dose, frequency, route')
    .eq('prescription_id', prescriptionId)
  return ((data ?? []) as PrescriptionItemRow[]).map((item) => ({
    itemId: item.id,
    productId: item.product_id,
    code: null,
    name: item.medication_name,
    dose: item.dose,
    frequency: item.frequency,
    route: item.route,
  }))
}

interface PersistArgs {
  actor: Actor
  organizationId: string
  branchId: string | null
  patientId: string
  prescriptionId: string
  dispenseId: string | null
  flow: ScreeningFlow
  drugs: ClinicalDrugRef[]
  patientContext: ClinicalPatientContext
  hasPatientProfile: boolean
  correlationId: string
}

async function persistScreening(db: UntypedDb, args: PersistArgs): Promise<ScreeningOutcome> {
  if (args.drugs.length === 0) {
    return failure('load_failed', 'No drugs to screen for this record')
  }

  const input: ClinicalCheckInput = { patient: args.patientContext, drugs: args.drugs }
  const { runClinicalCheck } = await import('./clinical/engine.server')
  const result = await runClinicalCheck(input)

  const warnings = result.warnings
  const severity = highestSeverity(warnings)
  const confidence = confidenceFor(result.providerId, {
    hasPatientProfile: args.hasPatientProfile,
  })
  const inputHash = screeningInputHash(
    args.drugs.map((drug) => ({
      name: drug.name,
      dose: drug.dose ?? null,
      route: drug.route ?? null,
    })),
  )

  const row = {
    organization_id: args.organizationId,
    branch_id: args.branchId,
    dispense_id: args.dispenseId,
    prescription_id: args.prescriptionId,
    patient_id: args.patientId,
    flow: args.flow,
    provider_id: result.providerId,
    provider_name: result.providerName,
    confidence,
    highest_severity: severity,
    warning_count: warnings.length,
    warnings,
    input_hash: inputHash,
    summary_ar: deterministicSummaryAr(warnings),
    summary_source: 'deterministic',
    correlation_id: args.correlationId,
    ran_by: args.actor.userId,
    ran_at: new Date().toISOString(),
  }

  const { data, error } = await db
    .from('hc_clinical_screenings')
    .insert(row)
    .select('*')
    .single()

  if (error) {
    // Idempotent replay: the same anchor + drug set already has evidence.
    if ((error as DbError).code === '23505') {
      const existing = await findExistingScreening(db, args, inputHash)
      if (existing) return { data: existing, error: null }
    }
    return failure('screening_failed', (error as DbError).message)
  }

  return { data: toSnapshot(data as Record<string, unknown>), error: null }
}

async function findExistingScreening(
  db: UntypedDb,
  args: PersistArgs,
  inputHash: string,
): Promise<ScreeningSnapshot | null> {
  let query = db.from('hc_clinical_screenings').select('*').eq('input_hash', inputHash)
  query = args.dispenseId
    ? query.eq('dispense_id', args.dispenseId)
    : query.eq('prescription_id', args.prescriptionId).is('dispense_id', null)
  const { data } = await query.maybeSingle()
  return data ? toSnapshot(data as Record<string, unknown>) : null
}

/** Run (and persist) a dispense screening. Never throws. */
export async function runDispenseScreening(args: {
  actor: Actor
  dispenseId: string
  flow?: ScreeningFlow
  correlationId: string
}): Promise<ScreeningOutcome> {
  try {
    const db = await database()
    const state = await featureState(db)
    if (state !== 'on') {
      return state === 'off'
        ? failure('feature_disabled', 'Clinical screening is disabled')
        : failure('load_failed', 'Clinical screening flag could not be read')
    }

    const dispense = await loadDispense(db, args.dispenseId)
    if (!dispense) return failure('not_found', 'Dispense not found')
    if (dispense.organization_id !== args.actor.organizationId) {
      return failure('forbidden', 'Forbidden: cross-org dispense')
    }

    const [{ context, hasProfile }, drugs] = await Promise.all([
      loadPatientContext(db, dispense.patient_id),
      loadDispenseDrugs(db, dispense.id, dispense.prescription_id),
    ])

    return await persistScreening(db, {
      actor: args.actor,
      organizationId: dispense.organization_id,
      branchId: dispense.branch_id,
      patientId: dispense.patient_id,
      prescriptionId: dispense.prescription_id,
      dispenseId: dispense.id,
      flow: args.flow ?? 'dispense',
      drugs,
      patientContext: context,
      hasPatientProfile: hasProfile,
      correlationId: args.correlationId,
    })
  } catch (error) {
    return failure('screening_failed', errorMessage(error))
  }
}

/** Run (and persist) a prescription-approval screening. Never throws. */
export async function runPrescriptionScreening(args: {
  actor: Actor
  prescriptionId: string
  correlationId: string
}): Promise<ScreeningOutcome> {
  try {
    const db = await database()
    const state = await featureState(db)
    if (state !== 'on') {
      return state === 'off'
        ? failure('feature_disabled', 'Clinical screening is disabled')
        : failure('load_failed', 'Clinical screening flag could not be read')
    }

    const prescription = await loadPrescription(db, args.prescriptionId)
    if (!prescription) return failure('not_found', 'Prescription not found')
    if (prescription.organization_id !== args.actor.organizationId) {
      return failure('forbidden', 'Forbidden: cross-org prescription')
    }

    const [{ context, hasProfile }, drugs] = await Promise.all([
      loadPatientContext(db, prescription.patient_id),
      loadPrescriptionDrugs(db, prescription.id),
    ])

    return await persistScreening(db, {
      actor: args.actor,
      organizationId: prescription.organization_id,
      branchId: prescription.branch_id,
      patientId: prescription.patient_id,
      prescriptionId: prescription.id,
      dispenseId: null,
      flow: 'prescription_approval',
      drugs,
      patientContext: context,
      hasPatientProfile: hasProfile,
      correlationId: args.correlationId,
    })
  } catch (error) {
    return failure('screening_failed', errorMessage(error))
  }
}

/** Latest screening for a dispense, scoped to the actor's organization. */
export async function getLatestDispenseScreening(args: {
  actor: Actor
  dispenseId: string
}): Promise<ScreeningLookup> {  try {
    const db = await database()
    const dispense = await loadDispense(db, args.dispenseId)
    if (!dispense) return { data: null, error: { code: 'not_found', message: 'Dispense not found' } }
    if (dispense.organization_id !== args.actor.organizationId) {
      return { data: null, error: { code: 'forbidden', message: 'Forbidden: cross-org dispense' } }
    }

    const { data, error } = await db
      .from('hc_clinical_screenings')
      .select('*')
      .eq('dispense_id', dispense.id)
      .order('ran_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      return { data: null, error: { code: 'load_failed', message: (error as DbError).message } }
    }
    return { data: data ? toSnapshot(data as Record<string, unknown>) : null, error: null }
  } catch (error) {
    return { data: null, error: { code: 'load_failed', message: errorMessage(error) } }
  }
}

/** One screening by id, scoped to the actor's organization. */
export async function getScreeningById(args: {
  actor: Actor
  screeningId: string
}): Promise<ScreeningLookup> {
  try {
    const db = await database()
    const { data, error } = await db
      .from('hc_clinical_screenings')
      .select('*')
      .eq('id', args.screeningId)
      .maybeSingle()
    if (error) {
      return { data: null, error: { code: 'load_failed', message: (error as DbError).message } }
    }
    if (!data) return { data: null, error: { code: 'not_found', message: 'Screening not found' } }

    const screening = toSnapshot(data as Record<string, unknown>)
    if (screening.organizationId !== args.actor.organizationId) {
      return { data: null, error: { code: 'forbidden', message: 'Forbidden: cross-org screening' } }
    }
    return { data: screening, error: null }
  } catch (error) {
    return { data: null, error: { code: 'load_failed', message: errorMessage(error) } }
  }
}

/**
 * Gate check used by dispensing: the latest screening is blocking when it is
 * `critical` and has not been overridden. Query failures are reported so the
 * caller can fail closed instead of silently dispensing.
 */
export async function getBlockingDispenseScreening(args: {
  actor: Actor
  dispenseId: string
}): Promise<ScreeningLookup> {
  try {
    const db = await database()
    const state = await featureState(db)
    if (state === 'off') return { data: null, error: null }
    if (state === 'error') {
      return { data: null, error: { code: 'load_failed', message: 'Clinical screening flag could not be read' } }
    }

    const dispense = await loadDispense(db, args.dispenseId)
    if (!dispense) return { data: null, error: { code: 'not_found', message: 'Dispense not found' } }
    if (dispense.organization_id !== args.actor.organizationId) {
      return { data: null, error: { code: 'forbidden', message: 'Forbidden: cross-org dispense' } }
    }

    const { data, error } = await db
      .from('hc_clinical_screenings')
      .select('*')
      .eq('dispense_id', dispense.id)
      .eq('highest_severity', 'critical')
      .is('override_reason', null)
      .order('ran_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      return { data: null, error: { code: 'load_failed', message: (error as DbError).message } }
    }
    return { data: data ? toSnapshot(data as Record<string, unknown>) : null, error: null }
  } catch (error) {
    return { data: null, error: { code: 'load_failed', message: errorMessage(error) } }
  }
}

/** Record a pharmacist override for a critical screening. */
export async function overrideDispenseScreening(args: {
  actor: Actor
  dispenseId: string
  screeningId: string
  reason: string
}): Promise<ScreeningOutcome> {
  try {
    const db = await database()
    const { data: row, error } = await db
      .from('hc_clinical_screenings')
      .select('*')
      .eq('id', args.screeningId)
      .maybeSingle()
    if (error) return failure('load_failed', (error as DbError).message)
    if (!row) return failure('not_found', 'Screening not found')

    const screening = toSnapshot(row as Record<string, unknown>)
    if (screening.organizationId !== args.actor.organizationId) {
      return failure('forbidden', 'Forbidden: cross-org screening')
    }
    if (screening.dispenseId !== args.dispenseId) {
      return failure('not_found', 'Screening does not belong to this dispense')
    }
    if (screening.highestSeverity !== 'critical') {
      return failure('no_override_required', 'Override is only required for critical findings')
    }

    const { data: updated, error: updateError } = await db
      .from('hc_clinical_screenings')
      .update({
        override_reason: args.reason,
        overridden_by: args.actor.userId,
        overridden_at: new Date().toISOString(),
      })
      .eq('id', args.screeningId)
      .select('*')
      .single()
    if (updateError) return failure('screening_failed', (updateError as DbError).message)

    return { data: toSnapshot(updated as Record<string, unknown>), error: null }
  } catch (error) {
    return failure('screening_failed', errorMessage(error))
  }
}
