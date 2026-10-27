import { describe, expect, it, vi } from 'vitest'
import { matchingServerCredential, resolveServerCredential, inspectServerBackend } from '@/lib/backend/server-credentials.server'
import { PUBLIC_BACKEND } from '../config/public-backend'

describe('selected-project server credentials', () => {
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
  it('recognizes a selected-project legacy server key independently of the old managed URL', () => {
    const key = `header.${btoa(JSON.stringify({ role: 'service_role', ref: PUBLIC_BACKEND.projectId }))}.synthetic`
    expect(resolveServerCredential({
      SUPABASE_URL: 'https://swyqqlpbjemarzzdxctw.supabase.co',
      SUPABASE_PROJECT_ID: 'swyqqlpbjemarzzdxctw',
      MUSLLY_SUPABASE_SERVICE_ROLE_KEY: key,
    })).toEqual({ issue: 'configured', source: 'custom', key })
  })
  it('fails closed instead of falling back when a custom binding is invalid', () => {
    expect(resolveServerCredential({
      SUPABASE_URL: PUBLIC_BACKEND.url,
      SUPABASE_PROJECT_ID: PUBLIC_BACKEND.projectId,
      SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_valid_managed_synthetic',
      MUSLLY_SUPABASE_PROJECT_ID: 'other',
      MUSLLY_SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_invalid_custom_synthetic',
    })).toEqual({ issue: 'project_mismatch', source: 'custom' })
  })
  it.each([
    [{}, 'missing'],
    [{ MUSLLY_SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_synthetic_only' }, 'missing_project_binding'],
    [{ MUSLLY_SUPABASE_PROJECT_ID: PUBLIC_BACKEND.projectId, MUSLLY_SUPABASE_SERVICE_ROLE_KEY: 'sb_publishable_synthetic' }, 'invalid_format'],
    [{ MUSLLY_SUPABASE_PROJECT_ID: 'other', MUSLLY_SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_synthetic_only' }, 'project_mismatch'],
  ] as const)('does not contact storage with invalid configuration %s', async (env, issue) => {
    const probe = vi.fn()
    const result = await inspectServerBackend(env, probe)
    expect(probe).not.toHaveBeenCalled()
    expect(result.configuration.issue).toBe(issue)
    expect(result.connection).toBe('not_checked')
  })
  const env = {
    MUSLLY_SUPABASE_PROJECT_ID: PUBLIC_BACKEND.projectId,
    MUSLLY_SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_synthetic_never_expose',
  }
  it('reports only approved bucket metadata after an actual successful probe', async () => {
    const probe = vi.fn().mockResolvedValue({ data: [
      { id: 'product-images', public: false },
      { id: 'private-patient-documents', public: false },
    ], error: null })
    const result = await inspectServerBackend(env, probe)
    expect(probe).toHaveBeenCalledExactlyOnceWith(env.MUSLLY_SUPABASE_SERVICE_ROLE_KEY)
    expect(result).toEqual({ projectId: PUBLIC_BACKEND.projectId,
      configuration: { issue: 'configured', source: 'custom' },
      connection: 'verified', productImages: 'private', catalogMedia: 'missing' })
    expect(JSON.stringify(result)).not.toContain(env.MUSLLY_SUPABASE_SERVICE_ROLE_KEY)
    expect(JSON.stringify(result)).not.toContain('private-patient-documents')
  })
  it.each([401, 403, '403'])('redacts rejected credential errors with status %s', async (status) => {
    const result = await inspectServerBackend(env, async () => ({ data: null,
      error: { statusCode: status, message: `request apikey=${env.MUSLLY_SUPABASE_SERVICE_ROLE_KEY}` } }))
    expect(result.connection).toBe('rejected')
    expect(result.productImages).toBe('not_checked')
    expect(JSON.stringify(result)).not.toContain(env.MUSLLY_SUPABASE_SERVICE_ROLE_KEY)
    expect(JSON.stringify(result)).not.toContain('apikey')
  })
  it('redacts thrown network errors and does not claim a valid connection', async () => {
    const result = await inspectServerBackend(env, async () => { throw new Error(env.MUSLLY_SUPABASE_SERVICE_ROLE_KEY) })
    expect(result.connection).toBe('unavailable')
    expect(JSON.stringify(result)).not.toContain(env.MUSLLY_SUPABASE_SERVICE_ROLE_KEY)
  })
  it('flags public product buckets for review', async () => {
    const result = await inspectServerBackend(env, async () => ({ data: [
      { id: 'product-images', public: true }, { id: 'catalog-media', public: false },
    ], error: null }))
    expect(result).toMatchObject({ connection: 'verified', productImages: 'public', catalogMedia: 'private' })
  })
})
