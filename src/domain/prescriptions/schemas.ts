export type PrescriptionStatus =
  | 'draft' | 'submitted' | 'validated' | 'approved' | 'cancelled'

export interface Prescription {
  id: string
  organization_id: string
  branch_id: string | null
  patient_id: string
  doctor_id: string | null
  external_doctor_name: string | null
  prescription_no: string | null
  issued_at: string
  status: PrescriptionStatus
  diagnosis: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PrescriptionItem {
  id: string
  prescription_id: string
  product_id: string | null
  medication_name: string
  strength: string | null
  form: string | null
  dose: string | null
  frequency: string | null
  duration_days: number | null
  quantity: number
  route: string | null
  instructions: string | null
  created_at: string
}

export interface PrescriptionStatusHistory {
  id: string
  prescription_id: string
  from_status: PrescriptionStatus | null
  to_status: PrescriptionStatus
  changed_by: string | null
  reason: string | null
  created_at: string
}

export interface PrescriptionNote {
  id: string
  prescription_id: string
  author_id: string | null
  body: string
  created_at: string
}

// State machine: allowed transitions
export const ALLOWED_TRANSITIONS: Record<PrescriptionStatus, PrescriptionStatus[]> = {
  draft:     ['submitted', 'cancelled'],
  submitted: ['validated', 'cancelled'],
  validated: ['approved',  'cancelled'],
  approved:  ['cancelled'],
  cancelled: [],
}

export function canTransition(from: PrescriptionStatus, to: PrescriptionStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}
