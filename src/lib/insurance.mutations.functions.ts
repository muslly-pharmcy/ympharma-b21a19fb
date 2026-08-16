// Insurance mutations — providers/plans setup, coverage, claims lifecycle, payments
import { createServerFn } from '@tanstack/react-start'
import {
  upsertProviderInput, upsertPlanInput, upsertPatientInsuranceInput,
  verifyCoverageInput, createAuthorizationInput, decideAuthorizationInput,
  createClaimInput, submitClaimInput, approveClaimInput, rejectClaimInput,
  recordPaymentInput, reconcileClaimInput, cancelClaimInput,
  type UpsertProviderInput, type UpsertPlanInput, type UpsertPatientInsuranceInput,
  type VerifyCoverageInput, type CreateAuthorizationInput, type DecideAuthorizationInput,
  type CreateClaimInput, type SubmitClaimInput, type ApproveClaimInput, type RejectClaimInput,
  type RecordPaymentInput, type ReconcileClaimInput, type CancelClaimInput,
} from '@/domain/insurance/commands'
import { canTransitionClaim, type ClaimStatus } from '@/domain/insurance/schemas'

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyDB = { from: (t: string) => any; rpc: (n: string, a?: unknown) => any }

async function loadDeps() {
  const [{ getActor, requireOrg, requirePermission }, { withIdempotency, newCorrelationId }, { supabaseAdmin }, { audit }] =
    await Promise.all([
      import('./session.server'),
      import('./idempotency.server'),
      import('@/integrations/supabase/client.server'),
      import('./audit.server'),
    ])
  return {
    getActor, requireOrg, requirePermission, withIdempotency, newCorrelationId,
    db: supabaseAdmin as unknown as AnyDB, audit,
  }
}

async function emit(event: string, payload: Record<string, unknown>, correlation: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  await (supabaseAdmin.rpc as unknown as (name: string, args: unknown) => Promise<unknown>)(
    'emit_domain_event',
    {
      p_event_type: event,
      p_source: 'insurance',
      p_payload: payload as unknown as never,
      p_priority: 'normal',
      p_correlation_id: correlation,
    },
  )
}

// ------------------------------------------------------------------
// Providers & plans (admin/manager only)
// ------------------------------------------------------------------
export const upsertInsuranceProvider = createServerFn({ method: 'POST' })
  .validator((raw: unknown): UpsertProviderInput => upsertProviderInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requireOrg, requirePermission, db, audit } = await loadDeps()
    const actor = await getActor()
    requireOrg(actor, data.organizationId)
    requirePermission(actor, 'insurance.write')

    const payload = {
      organization_id: data.organizationId,
      code: data.code,
      name: data.name,
      name_en: data.nameEn ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      website: data.website ?? null,
      address: data.address ?? null,
      notes: data.notes ?? null,
      is_active: data.isActive,
      created_by: actor.userId,
    }
    const row = data.id
      ? await db.from('insv2_providers').update(payload).eq('id', data.id).select('*').single()
      : await db.from('insv2_providers').insert(payload).select('*').single()
    if (row.error) throw new Error(row.error.message)
    await audit(actor, { action: data.id ? 'insurance.provider.update' : 'insurance.provider.create', resourceType: 'insv2_provider', resourceId: row.data.id })
    return { id: row.data.id as string }
  })

export const upsertInsurancePlan = createServerFn({ method: 'POST' })
  .validator((raw: unknown): UpsertPlanInput => upsertPlanInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requireOrg, requirePermission, db, audit } = await loadDeps()
    const actor = await getActor()
    requireOrg(actor, data.organizationId)
    requirePermission(actor, 'insurance.write')

    const payload = {
      organization_id: data.organizationId,
      provider_id: data.providerId,
      code: data.code,
      name: data.name,
      tier: data.tier ?? null,
      copay_percent: data.copayPercent,
      deductible: data.deductible,
      coverage_percent: data.coveragePercent,
      effective_from: data.effectiveFrom ?? null,
      effective_to: data.effectiveTo ?? null,
      is_active: data.isActive,
      created_by: actor.userId,
    }
    const row = data.id
      ? await db.from('insv2_plans').update(payload).eq('id', data.id).select('*').single()
      : await db.from('insv2_plans').insert(payload).select('*').single()
    if (row.error) throw new Error(row.error.message)
    await audit(actor, { action: data.id ? 'insurance.plan.update' : 'insurance.plan.create', resourceType: 'insv2_plan', resourceId: row.data.id })
    return { id: row.data.id as string }
  })

// ------------------------------------------------------------------
// Patient insurance linkage
// ------------------------------------------------------------------
export const upsertPatientInsurance = createServerFn({ method: 'POST' })
  .validator((raw: unknown): UpsertPatientInsuranceInput => upsertPatientInsuranceInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requireOrg, requirePermission, db, audit } = await loadDeps()
    const actor = await getActor()
    requireOrg(actor, data.organizationId)
    requirePermission(actor, 'insurance.write')

    const payload = {
      organization_id: data.organizationId,
      patient_id: data.patientId,
      plan_id: data.planId,
      policy_number: data.policyNumber,
      group_number: data.groupNumber ?? null,
      holder_name: data.holderName ?? null,
      holder_relation: data.holderRelation ?? null,
      priority: data.priority,
      status: data.status,
      valid_from: data.validFrom ?? null,
      valid_to: data.validTo ?? null,
      notes: data.notes ?? null,
      created_by: actor.userId,
    }
    const row = data.id
      ? await db.from('insv2_patient_insurance').update(payload).eq('id', data.id).select('*').single()
      : await db.from('insv2_patient_insurance').insert(payload).select('*').single()
    if (row.error) throw new Error(row.error.message)
    await audit(actor, { action: data.id ? 'insurance.patient.update' : 'insurance.patient.create', resourceType: 'insv2_patient_insurance', resourceId: row.data.id })
    return { id: row.data.id as string }
  })

// ------------------------------------------------------------------
// Coverage verification (advisory, based on stored data)
// ------------------------------------------------------------------
export const verifyCoverage = createServerFn({ method: 'POST' })
  .validator((raw: unknown): VerifyCoverageInput => verifyCoverageInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requireOrg, requirePermission, db, newCorrelationId, audit } = await loadDeps()
    const actor = await getActor()
    requireOrg(actor, data.organizationId)
    requirePermission(actor, 'insurance.read')
    const correlation = data.correlationId ?? newCorrelationId('ins')
    const onDate = data.onDate ?? new Date().toISOString().slice(0, 10)

    let q = db.from('insv2_patient_insurance')
      .select('*, plan:insv2_plans(*)')
      .eq('organization_id', data.organizationId)
      .eq('patient_id', data.patientId)
      .eq('status', 'active')
    if (data.planId) q = q.eq('plan_id', data.planId)
    const { data: rows, error } = await q
    if (error) throw new Error(error.message)

    const eligible = ((rows ?? []) as Array<{
      valid_from: string | null; valid_to: string | null; plan: { copay_percent: number; coverage_percent: number; deductible: number } | null;
      id: string; priority: string; policy_number: string;
    }>).map((r) => ({
      id: r.id,
      priority: r.priority,
      policy_number: r.policy_number,
      inDateRange: (!r.valid_from || r.valid_from <= onDate) && (!r.valid_to || r.valid_to >= onDate),
      plan: r.plan,
    }))
    const anyActive = eligible.some((e) => e.inDateRange)

    await emit('InsuranceVerified', {
      patient_id: data.patientId, plan_id: data.planId ?? null, on_date: onDate,
      eligible: anyActive, matches: eligible.length,
    }, correlation)
    await audit(actor, { action: 'insurance.verify', resourceType: 'hc_patient', resourceId: data.patientId, payload: { on_date: onDate, matches: eligible.length } })

    return { eligible: anyActive, onDate, matches: eligible, correlationId: correlation }
  })

// ------------------------------------------------------------------
// Authorizations
// ------------------------------------------------------------------
export const createAuthorization = createServerFn({ method: 'POST' })
  .validator((raw: unknown): CreateAuthorizationInput => createAuthorizationInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requireOrg, requirePermission, db, newCorrelationId, audit } = await loadDeps()
    const actor = await getActor()
    requireOrg(actor, data.organizationId)
    requirePermission(actor, 'insurance.write')
    const correlation = data.correlationId ?? newCorrelationId('ins')

    const { data: row, error } = await db.from('insv2_authorizations').insert({
      organization_id: data.organizationId,
      patient_id: data.patientId,
      plan_id: data.planId,
      prescription_id: data.prescriptionId ?? null,
      reference: data.reference ?? null,
      status: 'pending',
      approved_amount: data.approvedAmount ?? null,
      valid_from: data.validFrom ?? null,
      valid_to: data.validTo ?? null,
      reason: data.reason ?? null,
      notes: data.notes ?? null,
      created_by: actor.userId,
    }).select('id').single()
    if (error) throw new Error(error.message)
    await emit('InsuranceAuthorizationCreated', { authorization_id: row.id, patient_id: data.patientId }, correlation)
    await audit(actor, { action: 'insurance.authorization.create', resourceType: 'insv2_authorization', resourceId: row.id })
    return { id: row.id as string, correlationId: correlation }
  })

export const decideAuthorization = createServerFn({ method: 'POST' })
  .validator((raw: unknown): DecideAuthorizationInput => decideAuthorizationInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission, db, newCorrelationId, audit } = await loadDeps()
    const actor = await getActor()
    requirePermission(actor, 'insurance.approve')
    const correlation = data.correlationId ?? newCorrelationId('ins')

    const { error } = await db.from('insv2_authorizations').update({
      status: data.decision,
      approved_amount: data.approvedAmount ?? null,
      reason: data.reason ?? null,
      decided_by: actor.userId,
      decided_at: new Date().toISOString(),
    }).eq('id', data.authorizationId).eq('organization_id', actor.organizationId)
    if (error) throw new Error(error.message)
    await emit(`InsuranceAuthorization${data.decision === 'approved' ? 'Approved' : 'Rejected'}`, { authorization_id: data.authorizationId }, correlation)
    await audit(actor, { action: `insurance.authorization.${data.decision}`, resourceType: 'insv2_authorization', resourceId: data.authorizationId })
    return { ok: true as const, correlationId: correlation }
  })

// ------------------------------------------------------------------
// Claims lifecycle
// ------------------------------------------------------------------
async function loadClaim(id: string, orgId: string): Promise<{ id: string; status: ClaimStatus; organization_id: string; patient_id: string }> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const client = supabaseAdmin as unknown as AnyDB
  const { data, error } = await client.from('insv2_claims')
    .select('id, status, organization_id, patient_id').eq('id', id).single()
  if (error) throw new Error(error.message)
  if (data.organization_id !== orgId) throw new Error('Forbidden: cross-org claim')
  return data
}

async function writeClaimStatus(
  claimId: string, from: ClaimStatus, to: ClaimStatus,
  actorId: string, reason: string | null, patch: Record<string, unknown>,
) {
  if (!canTransitionClaim(from, to)) throw new Error(`Illegal claim transition: ${from} → ${to}`)
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const client = supabaseAdmin as unknown as AnyDB
  const { error } = await client.from('insv2_claims')
    .update({ status: to, ...patch }).eq('id', claimId)
  if (error) throw new Error(error.message)
  await client.from('insv2_claim_status_history').insert({
    claim_id: claimId, from_status: from, to_status: to,
    changed_by: actorId, reason,
  })
}

export const createInsuranceClaim = createServerFn({ method: 'POST' })
  .validator((raw: unknown): CreateClaimInput => createClaimInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requireOrg, requirePermission, withIdempotency, newCorrelationId, db, audit } = await loadDeps()
    const actor = await getActor()
    requireOrg(actor, data.organizationId)
    requirePermission(actor, 'insurance.write')
    const correlation = data.correlationId ?? newCorrelationId('clm')

    return withIdempotency(data.idempotencyKey, actor.userId, 'createInsuranceClaim', async () => {
      const totalBilled = data.items.reduce((s, it) => s + it.billedAmount, 0)
      const { data: claim, error } = await db.from('insv2_claims').insert({
        organization_id: data.organizationId,
        branch_id: actor.branchId,
        patient_id: data.patientId,
        provider_id: data.providerId,
        plan_id: data.planId,
        dispense_id: data.dispenseId ?? null,
        prescription_id: data.prescriptionId ?? null,
        authorization_id: data.authorizationId ?? null,
        status: 'draft',
        total_billed: totalBilled,
        currency: data.currency,
        diagnosis: data.diagnosis ?? null,
        notes: data.notes ?? null,
        correlation_id: correlation,
        created_by: actor.userId,
      }).select('id').single()
      if (error) throw new Error(error.message)
      const claimId = claim.id as string

      const itemRows = data.items.map((it) => ({
        claim_id: claimId,
        dispense_item_id: it.dispenseItemId ?? null,
        product_id: it.productId ?? null,
        description: it.description,
        quantity: it.quantity,
        unit_billed: it.unitBilled,
        billed_amount: it.billedAmount,
        notes: it.notes ?? null,
      }))
      const { error: itErr } = await db.from('insv2_claim_items').insert(itemRows)
      if (itErr) throw new Error(itErr.message)

      await db.from('insv2_claim_status_history').insert({
        claim_id: claimId, from_status: null, to_status: 'draft', changed_by: actor.userId,
      })
      await emit('InsuranceClaimCreated', { claim_id: claimId, total_billed: totalBilled }, correlation)
      await audit(actor, { action: 'insurance.claim.create', resourceType: 'insv2_claim', resourceId: claimId, payload: { items: itemRows.length, total_billed: totalBilled } })
      return { id: claimId, correlationId: correlation }
    })
  })

export const submitInsuranceClaim = createServerFn({ method: 'POST' })
  .validator((raw: unknown): SubmitClaimInput => submitClaimInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission, newCorrelationId, audit } = await loadDeps()
    const actor = await getActor()
    requirePermission(actor, 'insurance.write')
    const correlation = data.correlationId ?? newCorrelationId('clm')

    const c = await loadClaim(data.claimId, actor.organizationId)
    await writeClaimStatus(c.id, c.status, 'submitted', actor.userId, null, {
      submitted_at: new Date().toISOString(),
    })
    await emit('InsuranceClaimSubmitted', { claim_id: c.id }, correlation)
    await audit(actor, { action: 'insurance.claim.submit', resourceType: 'insv2_claim', resourceId: c.id })
    return { id: c.id, status: 'submitted' as const, correlationId: correlation }
  })

export const approveInsuranceClaim = createServerFn({ method: 'POST' })
  .validator((raw: unknown): ApproveClaimInput => approveClaimInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission, newCorrelationId, db, audit } = await loadDeps()
    const actor = await getActor()
    requirePermission(actor, 'insurance.approve')
    const correlation = data.correlationId ?? newCorrelationId('clm')

    const c = await loadClaim(data.claimId, actor.organizationId)
    if (c.status !== 'submitted' && c.status !== 'in_review') {
      throw new Error(`Cannot approve claim in status "${c.status}"`)
    }

    // Apply per-item adjustments if provided
    let totalAllowed = 0, totalCopay = 0, totalDeductible = 0
    for (const adj of data.itemAdjustments) {
      totalAllowed += adj.allowedAmount
      totalCopay += adj.copayAmount
      totalDeductible += adj.deductibleAmount
      const { error } = await db.from('insv2_claim_items').update({
        allowed_amount: adj.allowedAmount,
        copay_amount: adj.copayAmount,
        coinsurance_amount: adj.coinsuranceAmount,
        deductible_amount: adj.deductibleAmount,
        reason_code: adj.reasonCode ?? null,
      }).eq('id', adj.itemId).eq('claim_id', c.id)
      if (error) throw new Error(error.message)
    }

    // If no adjustments, mirror billed → allowed
    if (data.itemAdjustments.length === 0) {
      const { data: items } = await db.from('insv2_claim_items').select('id, billed_amount').eq('claim_id', c.id)
      for (const it of (items ?? []) as Array<{ id: string; billed_amount: number }>) {
        totalAllowed += it.billed_amount
        await db.from('insv2_claim_items').update({ allowed_amount: it.billed_amount }).eq('id', it.id)
      }
    }

    const to: ClaimStatus = data.partial ? 'partially_approved' : 'approved'
    await writeClaimStatus(c.id, c.status, to, actor.userId, data.notes ?? null, {
      total_allowed: totalAllowed,
      total_copay: totalCopay,
      total_deductible: totalDeductible,
      adjudicated_at: new Date().toISOString(),
    })
    await emit(data.partial ? 'InsuranceClaimPartiallyApproved' : 'InsuranceClaimApproved', {
      claim_id: c.id, total_allowed: totalAllowed,
    }, correlation)
    await audit(actor, { action: `insurance.claim.${to}`, resourceType: 'insv2_claim', resourceId: c.id, payload: { total_allowed: totalAllowed } })
    return { id: c.id, status: to, correlationId: correlation }
  })

export const rejectInsuranceClaim = createServerFn({ method: 'POST' })
  .validator((raw: unknown): RejectClaimInput => rejectClaimInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission, newCorrelationId, audit } = await loadDeps()
    const actor = await getActor()
    requirePermission(actor, 'insurance.approve')
    const correlation = data.correlationId ?? newCorrelationId('clm')

    const c = await loadClaim(data.claimId, actor.organizationId)
    await writeClaimStatus(c.id, c.status, 'rejected', actor.userId, data.reason, {
      reject_reason: data.reason,
      adjudicated_at: new Date().toISOString(),
    })
    await emit('InsuranceClaimRejected', { claim_id: c.id, reason: data.reason }, correlation)
    await audit(actor, { action: 'insurance.claim.reject', resourceType: 'insv2_claim', resourceId: c.id, payload: { reason: data.reason } })
    return { id: c.id, status: 'rejected' as const, correlationId: correlation }
  })

export const recordInsurancePayment = createServerFn({ method: 'POST' })
  .validator((raw: unknown): RecordPaymentInput => recordPaymentInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission, newCorrelationId, db, audit } = await loadDeps()
    const actor = await getActor()
    requirePermission(actor, 'insurance.approve')
    const correlation = data.correlationId ?? newCorrelationId('clm')

    const c = await loadClaim(data.claimId, actor.organizationId)
    const { error } = await db.from('insv2_payment_responses').insert({
      claim_id: c.id,
      amount: data.amount,
      method: data.method ?? null,
      reference: data.reference ?? null,
      received_at: data.receivedAt ?? new Date().toISOString(),
      notes: data.notes ?? null,
      recorded_by: actor.userId,
    })
    if (error) throw new Error(error.message)

    // Sum payments; move to paid when >= total_allowed
    const { data: sumRes } = await db.from('insv2_payment_responses')
      .select('amount').eq('claim_id', c.id)
    const totalPaid = ((sumRes ?? []) as Array<{ amount: number }>).reduce((s, r) => s + Number(r.amount), 0)
    const { data: claimRow } = await db.from('insv2_claims').select('total_allowed, total_billed, status').eq('id', c.id).single()
    const target = Number((claimRow as { total_allowed: number; total_billed: number })?.total_allowed || (claimRow as { total_billed: number })?.total_billed || 0)
    await db.from('insv2_claims').update({ total_paid: totalPaid }).eq('id', c.id)

    if (totalPaid > 0 && totalPaid >= target && ((claimRow as { status: ClaimStatus })?.status === 'approved' || (claimRow as { status: ClaimStatus })?.status === 'partially_approved')) {
      await writeClaimStatus(c.id, (claimRow as { status: ClaimStatus }).status, 'paid', actor.userId, null, {
        paid_at: new Date().toISOString(),
      })
      await emit('InsuranceClaimPaid', { claim_id: c.id, total_paid: totalPaid }, correlation)
    }
    await audit(actor, { action: 'insurance.payment.record', resourceType: 'insv2_claim', resourceId: c.id, payload: { amount: data.amount } })
    return { id: c.id, totalPaid, correlationId: correlation }
  })

export const reconcileInsuranceClaim = createServerFn({ method: 'POST' })
  .validator((raw: unknown): ReconcileClaimInput => reconcileClaimInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission, newCorrelationId, audit } = await loadDeps()
    const actor = await getActor()
    requirePermission(actor, 'insurance.approve')
    const correlation = data.correlationId ?? newCorrelationId('clm')

    const c = await loadClaim(data.claimId, actor.organizationId)
    if (!['paid','rejected','approved','partially_approved'].includes(c.status)) {
      throw new Error(`Cannot close claim in status "${c.status}"`)
    }
    await writeClaimStatus(c.id, c.status, 'closed', actor.userId, null, {})
    await emit('InsuranceClaimClosed', { claim_id: c.id }, correlation)
    await audit(actor, { action: 'insurance.claim.close', resourceType: 'insv2_claim', resourceId: c.id })
    return { id: c.id, status: 'closed' as const, correlationId: correlation }
  })

export const cancelInsuranceClaim = createServerFn({ method: 'POST' })
  .validator((raw: unknown): CancelClaimInput => cancelClaimInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission, newCorrelationId, audit } = await loadDeps()
    const actor = await getActor()
    requirePermission(actor, 'insurance.write')
    const correlation = data.correlationId ?? newCorrelationId('clm')

    const c = await loadClaim(data.claimId, actor.organizationId)
    await writeClaimStatus(c.id, c.status, 'cancelled', actor.userId, data.reason, {})
    await emit('InsuranceClaimCancelled', { claim_id: c.id, reason: data.reason }, correlation)
    await audit(actor, { action: 'insurance.claim.cancel', resourceType: 'insv2_claim', resourceId: c.id, payload: { reason: data.reason } })
    return { id: c.id, status: 'cancelled' as const, correlationId: correlation }
  })
