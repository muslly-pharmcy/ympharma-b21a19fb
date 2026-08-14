import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { Json } from '@/integrations/supabase/types'
import {
  asAnnouncement,
  asBoolean,
  asPharmacyStatus,
  type Announcement,
  type FeatureFlagKey,
  type PharmacyStatus,
} from '@/lib/control-tower/settings'

export interface PublicFlags {
  flags: Record<FeatureFlagKey, boolean>
  pharmacyStatus: PharmacyStatus
  announcement: Announcement
}

const DEFAULTS: PublicFlags = {
  flags: {
    enable_medication_vault: true,
    enable_ai_marketing: true,
    enable_delivery_orders: true,
    enable_clinical_inspector: true,
    maintenance_mode: false,
  },
  pharmacyStatus: 'OPEN',
  announcement: { active: false, text_ar: '', type: 'info' },
}

/**
 * Public, non-sensitive feature flags exposed through a narrow SECURITY DEFINER
 * function — the rest of app_settings stays admin-only.
 */
export function useFeatureFlags() {
  const query = useQuery({
    queryKey: ['feature-flags'],
    queryFn: async (): Promise<PublicFlags> => {
      const { data, error } = await supabase.rpc('public_feature_flags')
      if (error) throw new Error(error.message)
      const rows = (data ?? []) as { key: string; value: Json }[]
      const map = new Map(rows.map((r) => [r.key, r.value]))
      return {
        flags: {
          enable_medication_vault: asBoolean(map.get('enable_medication_vault'), true),
          enable_ai_marketing: asBoolean(map.get('enable_ai_marketing'), true),
          enable_delivery_orders: asBoolean(map.get('enable_delivery_orders'), true),
          enable_clinical_inspector: asBoolean(map.get('enable_clinical_inspector'), true),
          maintenance_mode: asBoolean(map.get('maintenance_mode'), false),
        },
        pharmacyStatus: asPharmacyStatus(map.get('pharmacy_status')),
        announcement: asAnnouncement(map.get('custom_announcement')),
      }
    },
    staleTime: 60_000,
    retry: 1,
  })

  const value = query.data ?? DEFAULTS
  return {
    ...value,
    isFlagEnabled: (key: FeatureFlagKey) => value.flags[key],
    isLoading: query.isLoading,
  }
}
