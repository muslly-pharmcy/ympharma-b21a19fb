/**
 * PII Detection Tests
 * Tests 10 types of PII detection and redaction
 */

import { describe, it, expect } from 'vitest';
import { detectPII, redactPII, containsPII, getPIISummary } from '../src/lib/ai/safety/pii-filter.server';

describe('detectPII', () => {
  it('detects email addresses', () => {
    const text = 'Contact us at support@example.com for help';
    const result = detectPII(text);
    expect(result.some(d => d.type === 'email')).toBe(true);
    expect(result.find(d => d.type === 'email')?.value).toBe('support@example.com');
  });

  it('detects phone numbers', () => {
    const text = 'Call +1-555-123-4567 for appointments';
    const result = detectPII(text);
    expect(result.some(d => d.type === 'phone')).toBe(true);
  });

  it('detects credit card numbers', () => {
    const text = 'Card: 4111-1111-1111-1111 for payment';
    const result = detectPII(text);
    expect(result.some(d => d.type === 'credit_card')).toBe(true);
  });

  it('detects SSN', () => {
    const text = 'SSN: 123-45-6789';
    const result = detectPII(text);
    expect(result.some(d => d.type === 'ssn')).toBe(true);
  });

  it('detects IP addresses', () => {
    const text = 'Server at 192.168.1.1';
    const result = detectPII(text);
    expect(result.some(d => d.type === 'ip')).toBe(true);
  });

  it('detects IBAN', () => {
    const text = 'Bank transfer to DE89 3704 0044 0532 0130 00';
    const result = detectPII(text);
    expect(result.some(d => d.type === 'iban')).toBe(true);
  });

  it('detects passport numbers', () => {
    const text = 'Passport AB123456';
    const result = detectPII(text);
    expect(result.some(d => d.type === 'passport')).toBe(true);
  });

  it('detects MRN', () => {
    const text = 'Patient MRN-12345678';
    const result = detectPII(text);
    expect(result.some(d => d.type === 'mrn')).toBe(true);
  });

  it('detects national ID', () => {
    const text = 'ID: 123456789';
    const result = detectPII(text);
    expect(result.some(d => d.type === 'national_id')).toBe(true);
  });

  it('detects multiple PII types', () => {
    const text = 'Email: john@example.com, Phone: +1-555-123-4567, SSN: 123-45-6789';
    const result = detectPII(text);
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result.some(d => d.type === 'email')).toBe(true);
    expect(result.some(d => d.type === 'phone')).toBe(true);
    expect(result.some(d => d.type === 'ssn')).toBe(true);
  });
});

describe('redactPII', () => {
  it('redacts all PII in text', () => {
    const text = 'Email: john@example.com and phone +1-555-123-4567';
    const result = redactPII(text);
    expect(result).not.toContain('john@example.com');
    expect(result).not.toContain('+1-555-123-4567');
    expect(result).toContain('[REDACTED]');
  });

  it('uses custom replacement', () => {
    const text = 'SSN: 123-45-6789';
    const result = redactPII(text, '***');
    expect(result).toContain('***');
    expect(result).not.toContain('123-45-6789');
  });
});

describe('containsPII', () => {
  it('returns true for text with PII', () => {
    expect(containsPII('Email: test@example.com')).toBe(true);
  });

  it('returns false for clean text', () => {
    expect(containsPII('Hello world, this is a test message')).toBe(false);
  });
});

describe('getPIISummary', () => {
  it('returns summary of PII types found', () => {
    const text = 'Email: a@b.com, Email: c@d.com, Phone: 555-1234';
    const summary = getPIISummary(text);
    expect(summary.email).toBeGreaterThanOrEqual(2);
    expect(summary.phone).toBeGreaterThanOrEqual(1);
  });
});
