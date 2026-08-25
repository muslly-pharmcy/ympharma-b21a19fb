/**
 * Auth error mapping: patients only ever see safe Arabic messages, and the
 * mapping never reveals whether an account exists.
 */
import { describe, expect, it } from 'vitest'
import { AUTH_MESSAGES_AR, getSafeAuthDiagnostic, toArabicAuthError } from '@/lib/auth/errors'

describe('toArabicAuthError', () => {
  it('maps rate limiting', () => {
    expect(toArabicAuthError(new Error('Email rate limit exceeded'))).toBe(
      AUTH_MESSAGES_AR.tooManyAttempts,
    )
    expect(toArabicAuthError(new Error('Request failed with status 429'))).toBe(
      AUTH_MESSAGES_AR.tooManyAttempts,
    )
  })

  it('maps OTP failures', () => {
    expect(toArabicAuthError(new Error('Token has expired'))).toBe(AUTH_MESSAGES_AR.expiredOtp)
    expect(toArabicAuthError(new Error('Invalid OTP'))).toBe(AUTH_MESSAGES_AR.invalidOtp)
  })

  it('maps credential and password failures', () => {
    expect(toArabicAuthError(new Error('Invalid login credentials'))).toBe(
      AUTH_MESSAGES_AR.invalidCredentials,
    )
    expect(toArabicAuthError(new Error('Password is too short'))).toBe(
      AUTH_MESSAGES_AR.weakPassword,
    )
  })

  it('maps a disabled phone provider to the Arabic phone-unavailable message', () => {
    expect(toArabicAuthError(new Error('Unsupported provider: provider is not enabled'))).toBe(
      AUTH_MESSAGES_AR.phoneDisabled,
    )
    expect(toArabicAuthError(new Error('Phone signups are disabled'))).toBe(
      AUTH_MESSAGES_AR.phoneDisabled,
    )
  })

  it('maps connectivity failures', () => {
    expect(toArabicAuthError(new Error('Failed to fetch'))).toBe(AUTH_MESSAGES_AR.network)
  })

  it('falls back to a generic message and never leaks raw provider text', () => {
    const raw = 'PGRST301: JWT expired for user 00000000-0000-0000-0000-000000000000'
    const message = toArabicAuthError(new Error(raw))
    expect(Object.values(AUTH_MESSAGES_AR)).toContain(message)
    expect(message).not.toContain('PGRST301')
    expect(toArabicAuthError(undefined)).toBe(AUTH_MESSAGES_AR.generic)
    expect(toArabicAuthError(null)).toBe(AUTH_MESSAGES_AR.generic)
  })

  it('never reveals whether an account exists', () => {
    const message = toArabicAuthError(new Error('User already registered'))
    expect(message).toBe(AUTH_MESSAGES_AR.generic)
  })

  it('maps confirmation and registration configuration failures', () => {
    expect(toArabicAuthError(new Error('Email not confirmed'))).toBe(
      AUTH_MESSAGES_AR.accountConfirmation,
    )
    expect(toArabicAuthError(new Error('Email address is invalid'))).toBe(
      AUTH_MESSAGES_AR.registrationConfig,
    )
  })

  it('redacts email addresses from development diagnostics', () => {
    const diagnostic = getSafeAuthDiagnostic(
      Object.assign(new Error('Failed for person@example.com'), { code: 'auth_failed', status: 400 }),
    )
    expect(diagnostic).toMatchObject({ code: 'auth_failed', status: 400 })
    expect(diagnostic.message).toContain('[redacted-email]')
    expect(diagnostic.message).not.toContain('person@example.com')
  })
})
