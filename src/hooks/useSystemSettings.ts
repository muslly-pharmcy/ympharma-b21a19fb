import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Json } from '@/integrations/supabase/types'
import { supabase } from '@/integrations/supabase/client'

export type SystemSettingValue = Json
export type SystemSettings = Record<string, SystemSettingValue>

export const SYSTEM_SETTINGS_QUERY_KEY = ['system-settings'] as const

interface SettingRow {
  key: string
  value: Json
  description: string | null
  updated_at: string
}

/**
 * Admin-side access to Control Tower settings stored in public.app_settings.
 * Reads/writes are gated by RLS (admin/owner) — the UI is not the authorization layer.
 */
export function useSystemSettings() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: SYSTEM_SETTINGS_QUERY_KEY,
    queryFn: async (): Promise<SystemSettings> => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value, description, updated_at')
        .order('key')
      if (error) throw new Error(error.message)
      const rows = (data ?? []) as SettingRow[]
      return rows.reduce<SystemSettings>((acc, row) => {
        acc[row.key] = row.value
        return acc
      }, {})
    },
    staleTime: 60_000,
  })

  // Single realtime channel; patches the cache instead of refetching.
  useEffect(() => {
    const channel = supabase
      .channel('control-tower:app_settings')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_settings' },
        (payload) => {
          const next = payload.new as Partial<SettingRow> | null
          if (!next?.key) return
          queryClient.setQueryData<SystemSettings>(SYSTEM_SETTINGS_QUERY_KEY, (prev) => ({
            ...(prev ?? {}),
            [next.key as string]: (next.value ?? null) as Json,
          }))
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient])

  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: SystemSettingValue }) => {
      const { data: userData } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('app_settings')
        .update({
          value,
          updated_by: userData.user?.id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('key', key)
        .select('key')
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) throw new Error('تعذر تحديث الإعداد — تحقق من الصلاحيات.')
    },
    onSuccess: (_result, variables) => {
      queryClient.setQueryData<SystemSettings>(SYSTEM_SETTINGS_QUERY_KEY, (prev) => ({
        ...(prev ?? {}),
        [variables.key]: variables.value,
      }))
      void queryClient.invalidateQueries({ queryKey: ['control-tower-audit'] })
      void queryClient.invalidateQueries({ queryKey: ['feature-flags'] })
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: SYSTEM_SETTINGS_QUERY_KEY })
    },
  })

  return {
    settings: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    updateSetting,
  }
}
