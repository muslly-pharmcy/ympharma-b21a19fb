// Server-function boundary for clinical screening.
//
// The service layer returns discriminated unions; this boundary decides what
// surfaces to the caller. Every function is authenticated and organization
// scoped, and every mutation is permission checked before it touches data.

import { createServerFn } from '@tanstack/react-start'
import type { ScreeningSnapshot } from '@/domain/clinical-screening/schemas'
import {
  dispenseIdInput,
  overrideScreeningInput,
  screenDispenseInput,
  screeningIdInput,
} from '@/domain/clinical-screening/schemas'
import {
  getLatestDispenseScreening,
  overrideDispenseScreening,
  runDispenseScreening,
  type ScreeningOutcome,
} from './clinical-screening.server'
import { summarizeScreening } from './clinical-screening-summary.server'

/** Distinguishable feature-gate failure (mapped to HTTP 501 semantics). */
export class FeatureDisabledError extends Error {
  readonly status = 501
  readonly code = 'feature_disabled'

  constructor() {
    super('Feature disabled: clinical screening is not enabled')
    this.name = 'FeatureDisabledError'
  }
}

function unwrap(outcome: ScreeningOutcome): ScreeningSnapshot {
  if (outcome.data) return outcome.data
  if (outcome.error.code === 'feature_disabled') throw new FeatureDisabledError()
  throw new Error(outcome.error.message)
}

export const screenDispense = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => screenDispenseInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { newCorrelationId } = await import('./idempotency.server')
    const actor = await getActor()
    requirePermission(actor, 'dispense.verify')

    const outcome = await runDispenseScreening({
      actor,
      dispenseId: data.dispenseId,
      flow: 'dispense',
      correlationId: data.correlationId ?? newCorrelationId('scr'),
    })
    return { screening: unwrap(outcome) }
  })

export const getDispenseScreening = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => dispenseIdInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const actor = await getActor()
    requirePermission(actor, 'dispense.read')

    const lookup = await getLatestDispenseScreening({ actor, dispenseId: data.dispenseId })
    if (lookup.error && lookup.error.code === 'feature_disabled') {
      throw new FeatureDisabledError()
    }
    if (lookup.error && lookup.error.code !== 'not_found') {
      throw new Error(lookup.error.message)
    }
    return { screening: lookup.data }
  })

export const overrideScreening = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => overrideScreeningInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'dispense.verify')

    const outcome = await overrideDispenseScreening({
      actor,
      dispenseId: data.dispenseId,
      screeningId: data.screeningId,
      reason: data.reason,
    })
    const screening = unwrap(outcome)

    await audit(actor, {
      action: 'dispense.screening.override',
      resourceType: 'dispense',
      resourceId: data.dispenseId,
      payload: {
        screening_id: data.screeningId,
        reason: data.reason,
        highest_severity: screening.highestSeverity,
      },
    })
    return { screening }
  })

export const summarizeDispenseScreening = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => screeningIdInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const actor = await getActor()
    requirePermission(actor, 'dispense.read')

    return summarizeScreening({ actor, screeningId: data.screeningId })
  })
