export interface Patient {
  id: string
  organization_id: string | null
  user_id: string | null
  mrn: string | null
  full_name: string
  phone: string | null
  email: string | null
  date_of_birth: string | null
  gender: string | null
  blood_type: string | null
  is_active: boolean
  merged_into_id: string | null
  metadata: Record<string, string | number | boolean | null>
  created_at: string
  updated_at: string
}

export interface PatientAllergy {
  id: string
  patient_id: string
  allergen: string
  severity: 'mild' | 'moderate' | 'severe' | 'life_threatening'
  reaction: string | null
  notes: string | null
  recorded_at: string
}

export interface PatientCondition {
  id: string
  patient_id: string
  condition_name: string
  icd10: string | null
  status: 'active' | 'resolved' | 'remission' | 'chronic'
  onset_date: string | null
  notes: string | null
}

export interface EmergencyContact {
  id: string
  patient_id: string
  name: string
  relation: string | null
  phone: string
  is_primary: boolean
}
