import { z } from 'zod'

const uuid = z.string().uuid()
const idem = z.object({
  idempotencyKey: z.string().min(8).max(128).optional(),
  correlationId: z.string().min(4).max(128).optional(),
})

// ---------- providers ----------
export const upsertProviderInput = idem.extend({
  organizationId: uuid,
  id: uuid.optional(),
  code: z.string().min(1).max(40),
  name: z.string().min(2).max(200),
  nameEn: z.string().max(200).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().nullable(),
  website: z.string().max(200).optional().nullable(),
  address: z.string().max(400).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  isActive: z.boolean().default(true),
})
export type UpsertProviderInput = z.infer<typeof upsertProviderInput>

// ---------- plans ----------
export const upsertPlanInput = idem.extend({
  organizationId: uuid,
  id: uuid.optional(),
  providerId: uuid,
  code: z.string().min(1).max(40),
  name: z.string().min(2).max(200),
  tier: z.string().max(60).optional().nullable(),
  copayPercent: z.number().min(0).max(100).default(0),
  deductible: z.number().min(0).default(0),
  coveragePercent: z.number().min(0).max(100).default(100),
  effectiveFrom: z.string().optional().nullable(),
  effectiveTo: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
})
export type UpsertPlanInput = z.infer<typeof upsertPlanInput>

// ---------- patient insurance ----------
export const upsertPatientInsuranceInput = idem.extend({
  organizationId: uuid,
  id: uuid.optional(),
  patientId: uuid,
  planId: uuid,
  policyNumber: z.string().min(1).max(80),
  groupNumber: z.string().max(80).optional().nullable(),
  holderName: z.string().max(200).optional().nullable(),
  holderRelation: z.string().max(60).optional().nullable(),
  priority: z.enum(['primary', 'secondary', 'tertiary']).default('primary'),
  status: z.enum(['active', 'inactive', 'expired', 'pending']).default('active'),
  validFrom: z.string().optional().nullable(),
  validTo: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
})
export type UpsertPatientInsuranceInput = z.infer<typeof upsertPatientInsuranceInput>

// ---------- coverage verification ----------
export const verifyCoverageInput = idem.extend({
  organizationId: uuid,
  patientId: uuid,
  planId: uuid.optional(),
  onDate: z.string().optional(),
})
export type VerifyCoverageInput = z.infer<typeof verifyCoverageInput>

// ---------- authorization ----------
export const createAuthorizationInput = idem.extend({
  organizationId: uuid,
  patientId: uuid,
  planId: uuid,
  prescriptionId: uuid.optional().nullable(),
  reference: z.string().max(120).optional().nullable(),
  approvedAmount: z.number().min(0).optional().nullable(),
  validFrom: z.string().optional().nullable(),
  validTo: z.string().optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
})
export type CreateAuthorizationInput = z.infer<typeof createAuthorizationInput>

export const decideAuthorizationInput = idem.extend({
  authorizationId: uuid,
  decision: z.enum(['approved', 'rejected']),
  approvedAmount: z.number().min(0).optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
})
export type DecideAuthorizationInput = z.infer<typeof decideAuthorizationInput>

// ---------- claims ----------
export const claimItemInput = z.object({
  dispenseItemId: uuid.optional().nullable(),
  productId: uuid.optional().nullable(),
  description: z.string().min(1).max(300),
  quantity: z.number().positive().default(1),
  unitBilled: z.number().min(0).default(0),
  billedAmount: z.number().min(0).default(0),
  notes: z.string().max(500).optional().nullable(),
})
export type ClaimItemInput = z.infer<typeof claimItemInput>

export const createClaimInput = idem.extend({
  organizationId: uuid,
  patientId: uuid,
  providerId: uuid,
  planId: uuid,
  dispenseId: uuid.optional().nullable(),
  prescriptionId: uuid.optional().nullable(),
  authorizationId: uuid.optional().nullable(),
  currency: z.string().length(3).default('YER'),
  diagnosis: z.string().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  items: z.array(claimItemInput).min(1).max(200),
})
export type CreateClaimInput = z.infer<typeof createClaimInput>

export const claimIdInput = idem.extend({ claimId: uuid })
export type ClaimIdInput = z.infer<typeof claimIdInput>

export const submitClaimInput = claimIdInput
export type SubmitClaimInput = z.infer<typeof submitClaimInput>

export const approveClaimInput = idem.extend({
  claimId: uuid,
  partial: z.boolean().default(false),
  itemAdjustments: z.array(z.object({
    itemId: uuid,
    allowedAmount: z.number().min(0),
    copayAmount: z.number().min(0).default(0),
    coinsuranceAmount: z.number().min(0).default(0),
    deductibleAmount: z.number().min(0).default(0),
    reasonCode: z.string().max(40).optional().nullable(),
  })).optional().default([]),
  notes: z.string().max(2000).optional().nullable(),
})
export type ApproveClaimInput = z.infer<typeof approveClaimInput>

export const rejectClaimInput = idem.extend({
  claimId: uuid,
  reason: z.string().min(2).max(500),
})
export type RejectClaimInput = z.infer<typeof rejectClaimInput>

export const recordPaymentInput = idem.extend({
  claimId: uuid,
  amount: z.number().min(0),
  method: z.string().max(60).optional().nullable(),
  reference: z.string().max(120).optional().nullable(),
  receivedAt: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
})
export type RecordPaymentInput = z.infer<typeof recordPaymentInput>

export const reconcileClaimInput = idem.extend({ claimId: uuid })
export type ReconcileClaimInput = z.infer<typeof reconcileClaimInput>

export const cancelClaimInput = idem.extend({
  claimId: uuid,
  reason: z.string().min(2).max(500),
})
export type CancelClaimInput = z.infer<typeof cancelClaimInput>
