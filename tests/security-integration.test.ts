/**
 * Integration Tests — Security Hardening + SUN-GUARDIAN
 * Tests the full security stack working together
 */

import { describe, it, expect } from 'vitest';
import { validateFileUpload } from '../src/lib/integrations/upload-validator';
import { sanitizeFormInput, PHARMACY_FORM_CONFIGS } from '../src/lib/integrations/sanitize-form';
import { runSunGuardian } from '../src/super-agent';
import { redactPII } from '../src/lib/ai/safety/pii-filter.server';
import { redactSensitive } from '../src/lib/observability/logger.server';
import { requirePermission } from '../src/lib/audit/secure-admin';

describe('🔒 Full Security Stack Integration', () => {
  describe('Upload → Sanitize → Error Handling Pipeline', () => {
    it('should reject malicious upload and log securely', async () => {
      const mockFile = new File(['exe content'], 'virus.pdf.exe', { type: 'application/pdf' });
      const result = await validateFileUpload(mockFile);
      expect(result.valid).toBe(false);
    });

    it('should sanitize form inputs before processing', () => {
      const dirtyForm = {
        patientName: '  John<script>alert(1)</script>  ',
        email: '  JOHN@EXAMPLE.COM  ',
        phone: '+1-555-123-4567',
        notes: 'a'.repeat(6000),
      };

      const clean = sanitizeFormInput(dirtyForm, PHARMACY_FORM_CONFIGS);
      expect(clean.patientName).not.toContain('<script>');
      expect(clean.email).toBe('john@example.com');
      expect(clean.phone).toBe('15551234567');
      expect(clean.notes.length).toBeLessThanOrEqual(5000);
    });

    it('should redact PII before AI processing', () => {
      const text = 'Contact john@example.com or call +1-555-123-4567. SSN: 123-45-6789';
      const redacted = redactPII(text);
      expect(redacted).not.toContain('john@example.com');
      expect(redacted).not.toContain('+1-555-123-4567');
      expect(redacted).not.toContain('123-45-6789');
      expect(redacted).toContain('[REDACTED]');
    });

    it('should redact sensitive fields in logs', () => {
      const data = {
        user: 'admin',
        password: 'secret123',
        token: 'Bearer abc123',
        medical_notes: 'Patient has diabetes',
      };
      const redacted = redactSensitive(data);
      expect(redacted.password).toBe('[REDACTED]');
      expect(redacted.token).toBe('[REDACTED]');
      expect(redacted.medical_notes).toBe('[REDACTED]');
      expect(redacted.user).toBe('admin');
    });
  });

  describe('SUN-GUARDIAN Agent Integration', () => {
    it('should process requests through security pipeline', async () => {
      const result = await runSunGuardian(
        { id: 'admin-1', permissions: ['admin'] },
        'كم مخزون الباراسيتامول؟',
        { criticalItems: [], correlationId: 'test-123' }
      );
      expect(result.response).not.toContain('🚫');
      expect(result.confidence).toBeGreaterThan(0.5);
    }, 30_000); // First allowed request dynamically loads the AI kernel.

    it('should block prohibited intents via constitution', async () => {
      const result = await runSunGuardian(
        { id: 'admin-1', permissions: ['admin'] },
        'أعطِ دواءً بدون وصفة',
        {}
      );
      expect(result.response).toContain('🚫');
    });

    it('should trigger error remediation for active errors', async () => {
      const result = await runSunGuardian(
        { id: 'admin-1', permissions: ['admin'] },
        'هناك خطأ في النظام',
        { activeErrors: [{ id: 'err-1', message: 'DB timeout' }] }
      );
      expect(result.response).toContain('🔧');
      expect(result.actions).toContain('auto_remediate');
    });
  });

  describe('Permission Enforcement', () => {
    it('should enforce permissions before operations', () => {
      const actor = { id: 'user-1', permissions: ['patient:delete'] };
      expect(() => requirePermission(actor, 'patient:delete')).not.toThrow();
    });

    it('should reject unauthorized operations', () => {
      const actor = { id: 'user-1', permissions: ['patient:delete'] };
      expect(() => requirePermission(actor, 'role:change')).toThrow();
    });
  });
});
