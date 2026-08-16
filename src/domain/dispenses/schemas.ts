export type DispenseStatus =
  | 'draft' | 'prepared' | 'verified' | 'dispensed' | 'completed' | 'returned' | 'cancelled'

export interface Dispense {
  id: string
  organization_id: string
  branch_id: string | null
  prescription_id: string
  patient_id: string
  dispense_no: string | null
  status: DispenseStatus
  prepared_by: string | null
  verified_by: string | null
  dispensed_by: string | null
  notes: string | null
  correlation_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface DispenseItem {
  id: string
  dispense_id: string
  prescription_item_id: string | null
  product_id: string | null
  medication_name: string
  qty_requested: number
  qty_dispensed: number
  reservation_id: string | null
  batch_allocations: Array<Record<string, string | number | null>>
  barcode_verified: boolean
  barcode_value: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DispenseStatusHistory {
  id: string
  dispense_id: string
  from_status: DispenseStatus | null
  to_status: DispenseStatus
  changed_by: string | null
  reason: string | null
  created_at: string
}

export interface DispenseReturn {
  id: string
  dispense_id: string
  dispense_item_id: string | null
  qty: number
  reason: string
  actor_user_id: string | null
  created_at: string
  updated_at: string
}

// State machine
//   draft → prepared → verified → dispensed → completed
//                                        ↓
//                                     returned
//   any (except completed/returned/cancelled) → cancelled
export const ALLOWED_DISPENSE_TRANSITIONS: Record<DispenseStatus, DispenseStatus[]> = {
  draft:     ['prepared', 'cancelled'],
  prepared:  ['verified', 'cancelled'],
  verified:  ['dispensed', 'cancelled'],
  dispensed: ['completed', 'returned'],
  completed: ['returned'],
  returned:  [],
  cancelled: [],
}

export function canTransitionDispense(from: DispenseStatus, to: DispenseStatus): boolean {
  return ALLOWED_DISPENSE_TRANSITIONS[from]?.includes(to) ?? false
}
