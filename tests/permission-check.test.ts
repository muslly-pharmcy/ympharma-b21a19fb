/**
 * Permission Check & Audit Log Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  requirePermission,
  secureQuery,
  auditDeletePatient,
  auditRoleChange,
  auditPriceChange,
  auditApiKeyChange,
  auditSecretChange,
  auditLogBuffer,
} from '../src/lib/audit/secure-admin';
import { ApiError } from '../src/lib/errors/api-error';

describe('requirePermission', () => {
  it('allows access with correct permission', () => {
    const actor = {
      id: 'user-1',
      permissions: ['patient:delete', 'role:change'] as const,
    };
    expect(() => requirePermission(actor, 'patient:delete')).not.toThrow();
  });

  it('throws FORBIDDEN without permission', () => {
    const actor = {
      id: 'user-1',
      permissions: ['role:change'] as const,
    };
    expect(() => requirePermission(actor, 'patient:delete')).toThrow(ApiError);
    try {
      requirePermission(actor, 'patient:delete');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe('FORBIDDEN');
      expect((err as ApiError).statusCode).toBe(403);
    }
  });

  it('includes correlationId in error', () => {
    const actor = {
      id: 'user-1',
      permissions: [] as const,
    };
    try {
      requirePermission(actor, 'patient:delete');
    } catch (err) {
      expect((err as ApiError).correlationId).toBeDefined();
      expect((err as ApiError).correlationId).toMatch(/^audit_/);
    }
  });
});

describe('secureQuery', () => {
  it('executes callback with permission', async () => {
    const actor = {
      id: 'user-1',
      permissions: ['patient:delete'] as const,
    };
    const result = await secureQuery(actor, 'patient:delete', async () => 'success');
    expect(result).toBe('success');
  });

  it('rejects callback without permission', async () => {
    const actor = {
      id: 'user-1',
      permissions: [] as const,
    };
    await expect(secureQuery(actor, 'patient:delete', async () => 'success')).rejects.toThrow(ApiError);
  });
});

describe('audit helpers', () => {
  beforeEach(() => {
    auditLogBuffer.length = 0;
  });

  it('auditDeletePatient creates log entry', async () => {
    const actor = { id: 'admin-1', permissions: ['patient:delete'] as const };
    await auditDeletePatient(actor, 'patient-123', 'John Doe');
    expect(auditLogBuffer.length).toBe(1);
    expect(auditLogBuffer[0].action).toBe('DELETE_PATIENT');
    expect(auditLogBuffer[0].resourceId).toBe('patient-123');
  });

  it('auditRoleChange creates log entry', async () => {
    const actor = { id: 'admin-1', permissions: ['role:change'] as const };
    await auditRoleChange(actor, 'user-2', 'pharmacist', 'manager');
    expect(auditLogBuffer.length).toBe(1);
    expect(auditLogBuffer[0].action).toBe('ROLE_CHANGE');
    expect(auditLogBuffer[0].oldValue).toEqual({ role: 'pharmacist' });
    expect(auditLogBuffer[0].newValue).toEqual({ role: 'manager' });
  });

  it('auditPriceChange creates log entry', async () => {
    const actor = { id: 'admin-1', permissions: ['price:change'] as const };
    await auditPriceChange(actor, 'product-1', 100, 120);
    expect(auditLogBuffer.length).toBe(1);
    expect(auditLogBuffer[0].action).toBe('PRICE_CHANGE');
    expect(auditLogBuffer[0].oldValue).toEqual({ price: 100 });
    expect(auditLogBuffer[0].newValue).toEqual({ price: 120 });
  });

  it('auditApiKeyChange creates log entry', async () => {
    const actor = { id: 'admin-1', permissions: ['apikey:change'] as const };
    await auditApiKeyChange(actor, 'key-1', 'created');
    expect(auditLogBuffer.length).toBe(1);
    expect(auditLogBuffer[0].action).toBe('APIKEY_CREATED');
  });

  it('auditSecretChange creates log entry', async () => {
    const actor = { id: 'admin-1', permissions: ['secret:change'] as const };
    await auditSecretChange(actor, 'db-password', 'updated');
    expect(auditLogBuffer.length).toBe(1);
    expect(auditLogBuffer[0].action).toBe('SECRET_UPDATED');
  });
});
