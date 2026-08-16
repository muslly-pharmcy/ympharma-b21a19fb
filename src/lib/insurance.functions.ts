// Insurance reads — providers, plans, coverage, claims
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type {
  InsuranceProvider, InsurancePlan, PatientInsurance,
  InsuranceClaim, InsuranceClaimItem, InsurancePaymentResponse,
  InsuranceClaimStatusHistory, InsuranceAuthorization,
} from '@/domain/insurance/schemas'

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyDB = { from: (t: string) => any; rpc: (n: string, a?: unknown) => any }

async function db(): Promise<AnyDB> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  return supabaseAdmin as unknown as AnyDB
}

// ----------------- providers -----------------
export const listInsuranceProviders = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => z.object({
    search: z.string().optional(),
    activeOnly: z.boolean().default(true),
    limit: z.number().int().min(1).max(200).default(100),
  }).parse(raw ?? {}))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const actor = await getActor()
    requirePermission(actor, 'insurance.read')
    const client = await db()
    let q = client.from('insv2_providers').select('*')
      .eq('organization_id', actor.organizationId)
      .order('name').limit(data.limit)
    if (data.activeOnly) q = q.eq('is_active', true)
    if (data.search) q = q.or(`name.ilike.%${data.search}%,code.ilike.%${data.search}%`)
    const { data: rows, error } = await q
    if (error) throw new Error(error.message)
    return { providers: (rows ?? []) as InsuranceProvider[] }
  })

// ----------------- plans -----------------
export const listInsurancePlans = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => z.object({
    providerId: z.string().uuid().optional(),
    activeOnly: z.boolean().default(true),
    limit: z.number().int().min(1).max(200).default(200),
  }).parse(raw ?? {}))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const actor = await getActor()
    requirePermission(actor, 'insurance.read')
    const client = await db()
    let q = client.from('insv2_plans').select('*, provider:insv2_providers(id, name, code)')
      .eq('organization_id', actor.organizationId)
      .order('name').limit(data.limit)
    if (data.providerId) q = q.eq('provider_id', data.providerId)
    if (data.activeOnly) q = q.eq('is_active', true)
    const { data: rows, error } = await q
    if (error) throw new Error(error.message)
    return { plans: (rows ?? []) as Array<InsurancePlan & {
      provider: { id: string; name: string; code: string } | null
    }> }
  })

// ----------------- patient coverage -----------------
export const getPatientCoverage = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => z.object({ patientId: z.string().uuid() }).parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const actor = await getActor()
    requirePermission(actor, 'insurance.read')
    const client = await db()
    const { data: rows, error } = await client
      .from('insv2_patient_insurance')
      .select('*, plan:insv2_plans(id, name, code, tier, copay_percent, coverage_percent, deductible, provider:insv2_providers(id, name, code))')
      .eq('organization_id', actor.organizationId)
      .eq('patient_id', data.patientId)
      .order('priority')
    if (error) throw new Error(error.message)
    type PlanNested = {
      id: string; name: string; code: string; tier: string | null;
      copay_percent: number; coverage_percent: number; deductible: number;
      provider: { id: string; name: string; code: string } | null;
    }
    return { coverage: (rows ?? []) as Array<PatientInsurance & { plan: PlanNested | null }> }
  })

// ----------------- claims list -----------------
export const listInsuranceClaims = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => z.object({
    status: z.string().optional(),
    search: z.string().optional(),
    patientId: z.string().uuid().optional(),
    providerId: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(200).default(100),
  }).parse(raw ?? {}))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const actor = await getActor()
    requirePermission(actor, 'insurance.read')
    const client = await db()
    let q = client.from('insv2_claims')
      .select('*, patient:hc_patients(id, full_name, mrn), provider:insv2_providers(id, name), plan:insv2_plans(id, name)')
      .eq('organization_id', actor.organizationId)
      .order('created_at', { ascending: false })
      .limit(data.limit)
    if (data.status) q = q.eq('status', data.status)
    if (data.patientId) q = q.eq('patient_id', data.patientId)
    if (data.providerId) q = q.eq('provider_id', data.providerId)
    if (data.search) q = q.ilike('claim_no', `%${data.search}%`)
    const { data: rows, error } = await q
    if (error) throw new Error(error.message)
    return { claims: (rows ?? []) as Array<InsuranceClaim & {
      patient: { id: string; full_name: string; mrn: string | null } | null
      provider: { id: string; name: string } | null
      plan: { id: string; name: string } | null
    }> }
  })

// ----------------- claim detail -----------------
export const getInsuranceClaim = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission, requireOrg } = await import('./session.server')
    const actor = await getActor()
    requirePermission(actor, 'insurance.read')
    const client = await db()
    const { data: claim, error } = await client
      .from('insv2_claims')
      .select('*, patient:hc_patients(id, full_name, mrn, phone), provider:insv2_providers(id, name, code), plan:insv2_plans(id, name, code, copay_percent, coverage_percent), authorization:insv2_authorizations(id, reference, status, approved_amount)')
      .eq('id', data.id).single()
    if (error) throw new Error(error.message)
    requireOrg(actor, (claim as { organization_id: string }).organization_id)

    const [{ data: items }, { data: payments }, { data: history }] = await Promise.all([
      client.from('insv2_claim_items').select('*').eq('claim_id', data.id).order('created_at'),
      client.from('insv2_payment_responses').select('*').eq('claim_id', data.id).order('received_at', { ascending: false }),
      client.from('insv2_claim_status_history').select('*').eq('claim_id', data.id).order('created_at'),
    ])

    return {
      claim: claim as InsuranceClaim & {
        patient: { id: string; full_name: string; mrn: string | null; phone: string | null } | null
        provider: { id: string; name: string; code: string } | null
        plan: { id: string; name: string; code: string; copay_percent: number; coverage_percent: number } | null
        authorization: { id: string; reference: string | null; status: string; approved_amount: number | null } | null
      },
      items: (items ?? []) as InsuranceClaimItem[],
      payments: (payments ?? []) as InsurancePaymentResponse[],
      history: (history ?? []) as InsuranceClaimStatusHistory[],
    }
  })

// ----------------- authorizations for a patient -----------------
export const listAuthorizations = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => z.object({
    patientId: z.string().uuid().optional(),
    status: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(50),
  }).parse(raw ?? {}))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const actor = await getActor()
    requirePermission(actor, 'insurance.read')
    const client = await db()
    let q = client.from('insv2_authorizations')
      .select('*, plan:insv2_plans(id, name, provider:insv2_providers(id, name))')
      .eq('organization_id', actor.organizationId)
      .order('created_at', { ascending: false })
      .limit(data.limit)
    if (data.patientId) q = q.eq('patient_id', data.patientId)
    if (data.status) q = q.eq('status', data.status)
    const { data: rows, error } = await q
    if (error) throw new Error(error.message)
    return { authorizations: (rows ?? []) as InsuranceAuthorization[] }
  })
