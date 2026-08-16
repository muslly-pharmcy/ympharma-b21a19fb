/**
 * Logger Redaction Tests
 * Tests redaction of 20 sensitive fields
 */

import { describe, it, expect } from 'vitest';
import { redactSensitive, safeLog, SENSITIVE_FIELDS } from '../src/lib/observability/logger.server';

describe('redactSensitive', () => {
  it('redacts password field', () => {
    const input = { username: 'john', password: 'secret123' };
    const result = redactSensitive(input);
    expect(result.password).toBe('[REDACTED]');
    expect(result.username).toBe('john');
  });

  it('redacts token fields', () => {
    const input = {
      access_token: 'abc123',
      refresh_token: 'xyz789',
      jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    };
    const result = redactSensitive(input);
    expect(result.access_token).toBe('[REDACTED]');
    expect(result.refresh_token).toBe('[REDACTED]');
    expect(result.jwt).toBe('[REDACTED]');
  });

  it('redacts API key fields', () => {
    const input = {
      api_key: 'sk-1234567890',
      apikey: 'sk-0987654321',
      secret: 'super-secret',
    };
    const result = redactSensitive(input);
    expect(result.api_key).toBe('[REDACTED]');
    expect(result.apikey).toBe('[REDACTED]');
    expect(result.secret).toBe('[REDACTED]');
  });

  it('redacts medical fields', () => {
    const input = {
      medical_notes: 'Patient has diabetes',
      patient_notes: 'Follow up in 2 weeks',
      diagnosis: 'Type 2 Diabetes',
    };
    const result = redactSensitive(input);
    expect(result.medical_notes).toBe('[REDACTED]');
    expect(result.patient_notes).toBe('[REDACTED]');
    expect(result.diagnosis).toBe('[REDACTED]');
  });

  it('redacts identity fields', () => {
    const input = {
      ssn: '123-45-6789',
      social_security: '987-65-4321',
      credit_card: '4111-1111-1111-1111',
      iban: 'DE89370400440532013000',
      passport: 'AB123456',
      national_id: '1234567890',
      mrn: 'MRN123456',
      dob: '1990-01-01',
      date_of_birth: '1990-01-01',
    };
    const result = redactSensitive(input);
    expect(result.ssn).toBe('[REDACTED]');
    expect(result.social_security).toBe('[REDACTED]');
    expect(result.credit_card).toBe('[REDACTED]');
    expect(result.iban).toBe('[REDACTED]');
    expect(result.passport).toBe('[REDACTED]');
    expect(result.national_id).toBe('[REDACTED]');
    expect(result.mrn).toBe('[REDACTED]');
    expect(result.dob).toBe('[REDACTED]');
    expect(result.date_of_birth).toBe('[REDACTED]');
  });

  it('redacts authorization header', () => {
    const input = {
      headers: {
        authorization: 'Bearer token123',
        cookie: 'session=abc',
        'set-cookie': 'session=abc',
      },
    };
    const result = redactSensitive(input);
    expect(result.headers.authorization).toBe('[REDACTED]');
    expect(result.headers.cookie).toBe('[REDACTED]');
    expect(result.headers['set-cookie']).toBe('[REDACTED]');
  });

  it('redacts nested objects recursively', () => {
    const input = {
      user: {
        name: 'John',
        password: 'secret',
        profile: {
          ssn: '123-45-6789',
        },
      },
    };
    const result = redactSensitive(input);
    expect(result.user.password).toBe('[REDACTED]');
    expect(result.user.profile.ssn).toBe('[REDACTED]');
    expect(result.user.name).toBe('John');
  });

  it('redacts arrays', () => {
    const input = [
      { password: 'secret1' },
      { password: 'secret2' },
    ];
    const result = redactSensitive(input);
    expect(result[0].password).toBe('[REDACTED]');
    expect(result[1].password).toBe('[REDACTED]');
  });

  it('handles null and undefined', () => {
    const input = { password: null, token: undefined, name: 'John' };
    const result = redactSensitive(input);
    expect(result.password).toBeNull();
    expect(result.token).toBeUndefined();
    expect(result.name).toBe('John');
  });

  it('has exactly 20+ sensitive fields defined', () => {
    expect(SENSITIVE_FIELDS.size).toBeGreaterThanOrEqual(20);
  });
});

describe('safeLog', () => {
  it('logs without throwing', () => {
    expect(() => {
      safeLog('info', 'Test message', { user: 'john', password: 'secret' });
    }).not.toThrow();
  });
});
