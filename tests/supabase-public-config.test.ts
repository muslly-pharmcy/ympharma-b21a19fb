import { describe, expect, it } from 'vitest'
import { resolvePublicSupabaseConfig, validatePublicConfig, serializePublicConfig, matchingServerCredential } from '@/integrations/supabase/public-config'
import { PUBLIC_BACKEND } from '../config/public-backend'

describe('public Supabase configuration', () => {
  it('never lets the stale managed runtime override the owner-selected project', () => {
    expect(
      resolvePublicSupabaseConfig({
        SUPABASE_URL: 'https://swyqqlpbjemarzzdxctw.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'server-publishable',
      }),
    ).toEqual({
      url: 'https://ybhrmcdlgyccywpmiucz.supabase.co',
      publishableKey: PUBLIC_BACKEND.publishableKey,
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
      url: PUBLIC_BACKEND.url,
      publishableKey: PUBLIC_BACKEND.publishableKey,
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
      url: PUBLIC_BACKEND.url,
      publishableKey: PUBLIC_BACKEND.publishableKey,
    })
  })
  it('rejects missing bootstrap values', () => {
    expect(() => validatePublicConfig({ url: undefined, publishableKey: undefined })).toThrow('missing')
  })
  it('rejects mismatched bootstrap configuration', () => {
    expect(() => validatePublicConfig({ url: 'https://swyqqlpbjemarzzdxctw.supabase.co', publishableKey: PUBLIC_BACKEND.publishableKey })).toThrow('match')
  })
  it('serializes only two public fields and escapes script terminators', () => {
    const json = serializePublicConfig({ url: '</script>', publishableKey: 'example-only', privateField: 'excluded' } as never)
    expect(json).not.toContain('<')
    expect(JSON.parse(json)).toEqual({ url: '</script>', publishableKey: 'example-only' })
  })
  it('blocks any privileged credential from a mismatched binding', () => {
    expect(matchingServerCredential({ SUPABASE_URL: 'https://swyqqlpbjemarzzdxctw.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-only' })).toBeUndefined()
  })
  it('requires securely bound project identity even for a matching URL', () => {
    expect(matchingServerCredential({ SUPABASE_URL: PUBLIC_BACKEND.url, SUPABASE_SERVICE_ROLE_KEY: 'synthetic-only' })).toBeUndefined()
    expect(matchingServerCredential({ SUPABASE_URL: PUBLIC_BACKEND.url, SUPABASE_PROJECT_ID: PUBLIC_BACKEND.projectId, SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_synthetic_only' })).toBe('sb_secret_synthetic_only')
  })
  it('accepts the explicitly bound custom server key while the managed project is old', () => {
    expect(matchingServerCredential({
      SUPABASE_URL: 'https://swyqqlpbjemarzzdxctw.supabase.co',
      MUSLLY_SUPABASE_PROJECT_ID: PUBLIC_BACKEND.projectId,
      MUSLLY_SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_synthetic_only',
    })).toBe('sb_secret_synthetic_only')
  })
  it('rejects public keys and old legacy server keys from the selected server binding', () => {
    const oldServerKey = `header.${btoa(JSON.stringify({ role: 'service_role', ref: 'swyqqlpbjemarzzdxctw' }))}.signature`
    for (const key of ['sb_publishable_synthetic_only', oldServerKey]) {
      expect(matchingServerCredential({ MUSLLY_SUPABASE_PROJECT_ID: PUBLIC_BACKEND.projectId, MUSLLY_SUPABASE_SERVICE_ROLE_KEY: key })).toBeUndefined()
    }
  })
  it('rejects a custom credential without a matching project binding', () => {
    expect(matchingServerCredential({ MUSLLY_SUPABASE_PROJECT_ID: 'other', MUSLLY_SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_synthetic_only' })).toBeUndefined()
  })
})
