// Read-only data bridge for AI features exposed to anonymous callers.
// Uses the publishable-key Supabase client — RLS applies as `anon`, and no
// write path is available from this module. Safe for public overlays.

export interface InventoryMatch {
  id: string
  name_ar: string
  brand: string | null
  barcode: string | null
  strength: string | null
  status: string
  requires_prescription: boolean
}

export interface DoctorMatch {
  id: string
  full_name_ar: string
  slug: string
  academic_title: string | null
  medical_title: string | null
}

export interface PharmacyMatch {
  id: string
  name_ar: string
  slug: string
  district: string | null
  phone: string | null
  is_24_7: boolean
}

export interface InventoryContext {
  matches: InventoryMatch[]
  doctors: DoctorMatch[]
  pharmacies: PharmacyMatch[]
  contextText: string
}

/**
 * Aggregated read-only context for the AI overlay: catalog matches +
 * verified public doctors + verified public pharmacies. Runs three
 * queries in parallel via the publishable-key client (RLS as `anon`).
 */
export async function fetchInventoryContext(
  query: string,
  limit = 5,
): Promise<InventoryContext> {
  const q = query.trim()
  if (!q) {
    return { matches: [], doctors: [], pharmacies: [], contextText: 'لا يوجد استعلام.' }
  }

  const { getPublicSupabase } = await import('@/lib/supabase-public.server')
  const supabase = getPublicSupabase()

  const like = `%${q.replace(/[%_]/g, '')}%`

  const [prodRes, docRes, phRes] = await Promise.all([
    supabase
      .from('catalog_products')
      .select('id,name_ar,brand,barcode,strength,status,requires_prescription')
      .or(`name_ar.ilike.${like},brand.ilike.${like},barcode.ilike.${like}`)
      .eq('status', 'approved')
      .eq('is_public', true)
      .limit(limit),
    supabase
      .from('hc_doctors')
      .select('id,full_name_ar,slug,academic_title,medical_title')
      .or(`full_name_ar.ilike.${like},full_name_en.ilike.${like}`)
      .eq('is_public', true)
      .eq('verification_status', 'verified')
      .limit(3),
    supabase
      .from('pn_pharmacies')
      .select('id,name_ar,slug,district,phone,is_24_7')
      .or(`name_ar.ilike.${like},district.ilike.${like},city.ilike.${like}`)
      .eq('is_public', true)
      .eq('verification_status', 'verified')
      .limit(3),
  ])

  const matches = (prodRes.data ?? []) as unknown as InventoryMatch[]
  const doctors = (docRes.data ?? []) as unknown as DoctorMatch[]
  const pharmacies = (phRes.data ?? []) as unknown as PharmacyMatch[]

  const parts: string[] = []
  if (matches.length) {
    parts.push(
      'المنتجات:\n' +
        matches
          .map(
            (p, i) =>
              `${i + 1}. ${p.name_ar}${p.brand ? ` — ${p.brand}` : ''}${
                p.strength ? ` (${p.strength})` : ''
              }${p.barcode ? ` [باركود: ${p.barcode}]` : ''}${
                p.requires_prescription ? ' [يستلزم روشتة]' : ''
              }`,
          )
          .join('\n'),
    )
  }
  if (doctors.length) {
    parts.push(
      'الأطباء:\n' +
        doctors
          .map(
            (d, i) =>
              `${i + 1}. ${d.academic_title ? d.academic_title + ' ' : ''}${d.full_name_ar}${
                d.medical_title ? ` — ${d.medical_title}` : ''
              }`,
          )
          .join('\n'),
    )
  }
  if (pharmacies.length) {
    parts.push(
      'الصيدليات:\n' +
        pharmacies
          .map(
            (p, i) =>
              `${i + 1}. ${p.name_ar}${p.district ? ` — ${p.district}` : ''}${
                p.is_24_7 ? ' [24 ساعة]' : ''
              }${p.phone ? ` — ${p.phone}` : ''}`,
          )
          .join('\n'),
    )
  }

  const contextText = parts.length === 0 ? 'لم يُعثر على نتائج مطابقة.' : parts.join('\n\n')
  return { matches, doctors, pharmacies, contextText }
}
