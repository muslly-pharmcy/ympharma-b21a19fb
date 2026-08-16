// Wave B — Enterprise Data Layer for legacy `src/modules/*` UIs.
// All reads go through server functions with requireSupabaseAuth so RLS runs as the caller.
// Return plain DTOs shaped for the current module UIs; missing tables surface as empty lists
// with a `warning` field (non-breaking, forward-compatible).
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const sel = (s: string): string => s

// ─── Pharmacy: products ─────────────────────────────────────────────────────
export interface ModuleProduct {
  id: string
  name: string
  nameAr: string
  price: number
  stock: number
  minStock: number
  barcode: string
}

export const listPharmacyProducts = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => z.object({ search: z.string().trim().max(80).default('') }).parse(raw ?? {}))
  .handler(async ({ data, context }): Promise<{ items: ModuleProduct[]; warning: string | null }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any
    let q = sb.from('products').select(sel('id, name, name_ar, price, stock, min_stock, barcode, is_active')).eq('is_active', true).limit(50)
    if (data.search) {
      const s = data.search.replace(/[,()*"']/g, ' ').trim()
      q = q.or(`name_ar.ilike.%${s}%,name.ilike.%${s}%,barcode.eq.${s}`)
    }
    const { data: rows, error } = await q
    if (error) return { items: [], warning: error.message }
    type Row = { id: string; name: string | null; name_ar: string | null; price: number | null; stock: number | null; min_stock: number | null; barcode: string | null }
    const items: ModuleProduct[] = ((rows ?? []) as Row[]).map((r) => ({
      id: r.id,
      name: r.name ?? '',
      nameAr: r.name_ar ?? r.name ?? '',
      price: Number(r.price ?? 0),
      stock: Number(r.stock ?? 0),
      minStock: Number(r.min_stock ?? 0),
      barcode: r.barcode ?? '',
    }))
    return { items, warning: null }
  })

// ─── Patients (hc_patients) ─────────────────────────────────────────────────
export interface ModulePatient {
  id: string
  name: string
  nameAr: string
  gender: 'male' | 'female' | 'other'
  dateOfBirth: string | null
  bloodType: string | null
  allergies: string[]
  chronicDiseases: string[]
}

export const listModulePatients = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ items: ModulePatient[]; warning: string | null }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any
    const { data, error } = await sb
      .from('hc_patients')
      .select(sel('id, full_name, gender, date_of_birth, blood_type'))
      .eq('is_active', true)
      .limit(100)
    if (error) return { items: [], warning: error.message }
    type Row = { id: string; full_name: string | null; gender: string | null; date_of_birth: string | null; blood_type: string | null }
    const items: ModulePatient[] = ((data ?? []) as Row[]).map((r) => ({
      id: r.id,
      name: r.full_name ?? '',
      nameAr: r.full_name ?? '',
      gender: (r.gender === 'male' || r.gender === 'female') ? r.gender : 'other',
      dateOfBirth: r.date_of_birth,
      bloodType: r.blood_type,
      allergies: [],
      chronicDiseases: [],
    }))
    return { items, warning: null }
  })

// ─── Doctors (hc_doctors) ────────────────────────────────────────────────────
export interface ModuleDoctor {
  id: string
  nameAr: string
  specialty: string
  phone: string
  rating: number
  reviewCount: number
  isVerified: boolean
  avatar: string | null
  clinicAddress: string | null
}

export const listModuleDoctors = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => z.object({ specialty: z.string().trim().max(80).default('all') }).parse(raw ?? {}))
  .handler(async ({ data, context }): Promise<{ items: ModuleDoctor[]; warning: string | null }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any
    // NOTE: `phone_e164` is intentionally excluded — column-level grants on
    // hc_doctors REVOKE SELECT on phone/qr_token from anon+authenticated. Public
    // directory hides the phone; contact goes through the request flow.
    let q = sb.from('hc_doctors')
      .select(sel('id, full_name_ar, medical_title, verification_status, photo_url'))
      .eq('is_public', true)
      .eq('verification_status', 'verified')
      .limit(60)
    if (data.specialty !== 'all') q = q.eq('medical_title', data.specialty)
    const { data: rows, error } = await q
    if (error) return { items: [], warning: error.message }
    type Row = { id: string; full_name_ar: string | null; medical_title: string | null; verification_status: string | null; photo_url: string | null }
    const items: ModuleDoctor[] = ((rows ?? []) as Row[]).map((r) => ({
      id: r.id,
      nameAr: r.full_name_ar ?? '',
      specialty: r.medical_title ?? '',
      phone: '',
      rating: 0,
      reviewCount: 0,
      isVerified: r.verification_status === 'verified',
      avatar: r.photo_url,
      clinicAddress: null,
    }))
    return { items, warning: null }
  })

// ─── Delivery (no dedicated table yet — orders with delivery status) ────────
export interface ModuleDelivery {
  id: string
  orderId: string
  status: 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed'
  estimatedTime: string | null
  notes: string | null
  createdAt: string
}

export const listModuleDeliveries = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => z.object({ status: z.enum(['all', 'assigned', 'in_transit', 'delivered']).default('all') }).parse(raw ?? {}))
  .handler(async ({ data, context }): Promise<{ items: ModuleDelivery[]; warning: string | null }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any
    // No `deliveries` table in current schema — synthesize from `orders`.
    let q = sb.from('orders').select(sel('id, status, notes, created_at')).order('created_at', { ascending: false }).limit(50)
    if (data.status !== 'all') q = q.eq('status', data.status)
    const { data: rows, error } = await q
    if (error) return { items: [], warning: 'deliveries table not present; showing orders as fallback' }
    type Row = { id: string; status: string | null; notes: string | null; created_at: string }
    const items: ModuleDelivery[] = ((rows ?? []) as Row[]).map((r) => ({
      id: r.id,
      orderId: r.id,
      status: (['assigned', 'picked_up', 'in_transit', 'delivered', 'failed'].includes(r.status ?? '') ? r.status : 'assigned') as ModuleDelivery['status'],
      estimatedTime: null,
      notes: r.notes,
      createdAt: r.created_at,
    }))
    return { items, warning: null }
  })

// ─── Finance (billing_ledger as source of truth) ────────────────────────────
export interface ModuleTransaction {
  id: string
  type: 'income' | 'expense' | 'transfer'
  category: string
  amount: number
  description: string
  createdAt: string
}

export const listModuleTransactions = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ items: ModuleTransaction[]; warning: string | null }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any
    const { data, error } = await sb
      .from('billing_ledger')
      .select(sel('id, direction, category, amount_cents, description, created_at'))
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) return { items: [], warning: error.message }
    type Row = { id: string; direction: string | null; category: string | null; amount_cents: number | null; description: string | null; created_at: string }
    const items: ModuleTransaction[] = ((data ?? []) as Row[]).map((r) => ({
      id: r.id,
      type: (r.direction === 'credit' ? 'income' : r.direction === 'debit' ? 'expense' : 'transfer'),
      category: r.category ?? '',
      amount: Number(r.amount_cents ?? 0) / 100,
      description: r.description ?? '',
      createdAt: r.created_at,
    }))
    return { items, warning: null }
  })
