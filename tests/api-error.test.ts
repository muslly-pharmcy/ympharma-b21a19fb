/**
 * API Error Tests
 * Tests toLogEntry, apiErrorFromUnknown, isApiError
 */

import { describe, it, expect } from 'vitest';
import { ApiError, apiErrorFromUnknown, isApiError } from '../src/lib/errors/api-error';

describe('ApiError', () => {
  it('creates error with correct properties', () => {
    const err = new ApiError('NOT_FOUND', 404, 'Resource not found');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Resource not found');
    expect(err.correlationId).toBeDefined();
    expect(err.timestamp).toBeDefined();
  });

  it('toJSON does not expose _internal', () => {
    const err = new ApiError('INTERNAL_ERROR', 500, 'Server error', {
      context: {
        organizationId: 'org-1',
        userId: 'user-1',
        functionName: 'testFn',
        executionTimeMs: 123,
      },
    });
    const json = err.toJSON();
    expect(json.error).toBeDefined();
    expect(json.error.code).toBe('INTERNAL_ERROR');
    expect(json.error.message).toBe('Server error');
    expect((json.error as Record<string, unknown>).details).toBeUndefined();
    expect((json as Record<string, unknown>)._internal).toBeUndefined();
  });

  it('toLogEntry includes _internal block', () => {
    const err = new ApiError('INTERNAL_ERROR', 500, 'Server error', {
      context: {
        organizationId: 'org-1',
        userId: 'user-1',
        functionName: 'testFn',
        executionTimeMs: 123,
      },
    });
    const logEntry = err.toLogEntry();
    expect(logEntry._internal).toBeDefined();
    expect((logEntry._internal as Record<string, unknown>).organizationId).toBe('org-1');
    expect((logEntry._internal as Record<string, unknown>).userId).toBe('user-1');
    expect((logEntry._internal as Record<string, unknown>).functionName).toBe('testFn');
    expect((logEntry._internal as Record<string, unknown>).executionTimeMs).toBe(123);
    expect((logEntry._internal as Record<string, unknown>).errorCode).toBe('INTERNAL_ERROR');
    expect((logEntry._internal as Record<string, unknown>).timestamp).toBeDefined();
  });

  it('toLogEntry merges context parameter', () => {
    const err = new ApiError('BAD_REQUEST', 400, 'Invalid input');
    const logEntry = err.toLogEntry({
      organizationId: 'org-2',
      userId: 'user-2',
      functionName: 'mergeTest',
      executionTimeMs: 456,
    });
    expect((logEntry._internal as Record<string, unknown>).organizationId).toBe('org-2');
    expect((logEntry._internal as Record<string, unknown>).functionName).toBe('mergeTest');
  });

  it('includes correlationId in toJSON', () => {
    const err = new ApiError('NOT_FOUND', 404, 'Not found');
    const json = err.toJSON();
    expect(json.error.correlationId).toBe(err.correlationId);
    expect(json.error.correlationId).toMatch(/^err_/);
  });

  it('includes timestamp in toJSON', () => {
    const err = new ApiError('NOT_FOUND', 404, 'Not found');
    const json = err.toJSON();
    expect(json.error.timestamp).toBe(err.timestamp);
    expect(new Date(json.error.timestamp as string).getTime()).not.toBeNaN();
  });
});

describe('apiErrorFromUnknown', () => {
  it('returns ApiError as-is', () => {
    const original = new ApiError('NOT_FOUND', 404, 'Original');
    const result = apiErrorFromUnknown(original);
    expect(result).toBe(original);
  });

  it('wraps standard Error', () => {
    const original = new Error('Something broke');
    const result = apiErrorFromUnknown(original);
    expect(result).toBeInstanceOf(ApiError);
    expect(result.code).toBe('INTERNAL_ERROR');
    expect(result.statusCode).toBe(500);
    expect(result.message).toBe('Something broke');
  });

  it('wraps unknown values', () => {
    const result = apiErrorFromUnknown('random string');
    expect(result).toBeInstanceOf(ApiError);
    expect(result.code).toBe('INTERNAL_ERROR');
    expect(result.message).toBe('An unexpected error occurred');
  });
});

describe('isApiError', () => {
  it('returns true for ApiError', () => {
    expect(isApiError(new ApiError('NOT_FOUND', 404, 'Test'))).toBe(true);
  });

  it('returns false for standard Error', () => {
    expect(isApiError(new Error('Test'))).toBe(false);
  });

  it('returns false for strings', () => {
    expect(isApiError('error')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isApiError(null)).toBe(false);
  });
});
