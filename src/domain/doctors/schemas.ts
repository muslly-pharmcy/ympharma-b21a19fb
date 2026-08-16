export interface Doctor {
  id: string
  organization_id: string | null
  user_id: string | null
  slug: string | null
  full_name_ar: string
  full_name_en: string | null
  title: string | null
  bio_ar: string | null
  bio_en: string | null
  photo_url: string | null
  years_experience: number | null
  languages: string[] | null
  gender: string | null
  verification_status: string | null
  created_at: string
  updated_at: string
}

export interface DoctorLicense {
  id: string
  doctor_id: string
  license_number: string
  authority: string | null
  country: string | null
  valid_from: string | null
  valid_to: string | null
  document_url: string | null
  status: 'active' | 'expired' | 'suspended' | 'revoked'
}
