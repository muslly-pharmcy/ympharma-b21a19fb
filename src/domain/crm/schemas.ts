export type CustomerStatus = 'active' | 'archived' | 'merged'

export interface Customer {
  id: string
  organization_id: string
  code: string
  full_name: string
  phone: string | null
  email: string | null
  patient_id: string | null
  status: CustomerStatus
  merged_into_id: string | null
  notes: string | null
  // metadata is stored server-side but omitted from serialized payloads to keep them JSON-safe.
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CustomerAddress {
  id: string
  organization_id: string
  customer_id: string
  kind: 'billing' | 'shipping' | 'other'
  line1: string
  line2: string | null
  city: string | null
  region: string | null
  country: string | null
  postal_code: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface CustomerContact {
  id: string
  organization_id: string
  customer_id: string
  kind: 'phone' | 'email' | 'whatsapp' | 'other'
  value: string
  label: string | null
  is_primary: boolean
  created_at: string
  updated_at: string
}

export interface CustomerTag {
  id: string
  organization_id: string
  customer_id: string
  tag: string
  color: string | null
  created_at: string
}
