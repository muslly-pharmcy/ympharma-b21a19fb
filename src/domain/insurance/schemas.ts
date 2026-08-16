// ============================================================================
// Insurance (Shipment C4A) — domain types + state machine
// ============================================================================
export type ClaimStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'approved'
  | 'partially_approved'
  | 'rejected'
  | 'paid'
  | 'closed'
  | 'cancelled'

export const ALLOWED_CLAIM_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['in_review', 'approved', 'partially_approved', 'rejected', 'cancelled'],
  in_review: ['approved', 'partially_approved', 'rejected', 'cancelled'],
  approved: ['paid', 'closed', 'cancelled'],
  partially_approved: ['paid', 'closed', 'cancelled'],
  rejected: ['closed'],
  paid: ['closed'],
  closed: [],
  cancelled: [],
}

export function canTransitionClaim(from: ClaimStatus, to: ClaimStatus): boolean {
  return ALLOWED_CLAIM_TRANSITIONS[from]?.includes(to) ?? false
}

export interface InsuranceProvider {
  id: string
  organization_id: string
  code: string
  name: string
  name_en: string | null
  phone: string | null
  email: string | null
  website: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface InsurancePlan {
  id: string
  organization_id: string
  provider_id: string
  code: string
  name: string
  tier: string | null
  copay_percent: number
  deductible: number
  coverage_percent: number
  effective_from: string | null
  effective_to: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PatientInsurance {
  id: string
  organization_id: string
  patient_id: string
  plan_id: string
  policy_number: string
  group_number: string | null
  holder_name: string | null
  holder_relation: string | null
  priority: 'primary' | 'secondary' | 'tertiary'
  status: 'active' | 'inactive' | 'expired' | 'pending'
  valid_from: string | null
  valid_to: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface InsuranceClaim {
  id: string
  organization_id: string
  branch_id: string | null
  claim_no: string | null
  patient_id: string
  dispense_id: string | null
  prescription_id: string | null
  provider_id: string
  plan_id: string
  authorization_id: string | null
  status: ClaimStatus
  total_billed: number
  total_allowed: number
  total_copay: number
  total_deductible: number
  total_paid: number
  currency: string
  diagnosis: string | null
  submitted_at: string | null
  adjudicated_at: string | null
  paid_at: string | null
  reject_reason: string | null
  notes: string | null
  correlation_id: string | null
  created_at: string
  updated_at: string
}

export interface InsuranceClaimItem {
  id: string
  claim_id: string
  dispense_item_id: string | null
  product_id: string | null
  description: string
  quantity: number
  unit_billed: number
  billed_amount: number
  allowed_amount: number
  copay_amount: number
  coinsurance_amount: number
  deductible_amount: number
  paid_amount: number
  reason_code: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface InsuranceAuthorization {
  id: string
  organization_id: string
  patient_id: string
  plan_id: string
  prescription_id: string | null
  reference: string | null
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled'
  approved_amount: number | null
  valid_from: string | null
  valid_to: string | null
  reason: string | null
  notes: string | null
  decided_by: string | null
  decided_at: string | null
  created_at: string
  updated_at: string
}

export interface InsurancePaymentResponse {
  id: string
  claim_id: string
  amount: number
  method: string | null
  reference: string | null
  received_at: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface InsuranceClaimStatusHistory {
  id: string
  claim_id: string
  from_status: ClaimStatus | null
  to_status: ClaimStatus
  changed_by: string | null
  reason: string | null
  created_at: string
}
