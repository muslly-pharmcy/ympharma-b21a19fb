import { describe, expect, it } from 'vitest'
import { resolvePublicSupabaseConfig } from '@/integrations/supabase/public-config'

describe('public Supabase configuration', () => {
  it('prefers server runtime values when Lovable provides them', () => {
    expect(
      resolvePublicSupabaseConfig({
        SUPABASE_URL: 'https://server.example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'server-publishable',
      }),
    ).toEqual({
      url: 'https://server.example.supabase.co',
      publishableKey: 'server-publishable',
    })
  })

  it('falls back to Vite public values in Lovable worker builds', () => {
    expect(
      resolvePublicSupabaseConfig(
        {},
        {
          VITE_SUPABASE_URL: 'https://vite.example.supabase.co',
          VITE_SUPABASE_PUBLISHABLE_KEY: 'vite-publishable',
        },
      ),
    ).toEqual({
      url: 'https://vite.example.supabase.co',
      publishableKey: 'vite-publishable',
    })
  })

  it('accepts the legacy public anon-key name without using a service-role key', () => {
    expect(
      resolvePublicSupabaseConfig({
        VITE_SUPABASE_URL: 'https://legacy.example.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'legacy-anon',
        SUPABASE_SERVICE_ROLE_KEY: 'must-not-be-selected',
      }),
    ).toEqual({
      url: 'https://legacy.example.supabase.co',
      publishableKey: 'legacy-anon',
    })
  })
})
