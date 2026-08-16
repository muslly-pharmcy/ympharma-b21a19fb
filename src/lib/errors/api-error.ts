/**
 * API Error with Internal Metadata Logging
 * toLogEntry adds _internal block that never goes to client
 */

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'TIMEOUT';

export interface ApiErrorContext {
  organizationId?: string;
  userId?: string;
  functionName?: string;
  executionTimeMs?: number;
  correlationId?: string;
  [key: string]: unknown;
}

export interface ApiErrorOptions {
  statusCode?: number;
  details?: Record<string, unknown>;
  cause?: Error;
  context?: ApiErrorContext;
}

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details: Record<string, unknown>;
  readonly correlationId: string;
  readonly timestamp: string;
  readonly context?: ApiErrorContext;
  declare cause?: unknown;

  constructor(
    code: ErrorCode,
    statusCode: number,
    message: string,
    options: ApiErrorOptions = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = options.details || {};
    this.correlationId = (options.details?.correlationId as string) || generateCorrelationId();
    this.timestamp = new Date().toISOString();
    this.context = options.context;

    if (options.cause) {
      this.cause = options.cause;
    }

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  /**
   * Client-facing JSON (NEVER exposes _internal)
   */
  toJSON(): Record<string, unknown> {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        correlationId: this.correlationId,
        timestamp: this.timestamp,
        ...(Object.keys(this.details).length > 0 ? { details: this.sanitizeDetails() } : {}),
      },
    };
  }

  /**
   * Sanitize details for client (remove sensitive fields)
   */
  private sanitizeDetails(): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(this.details)) {
      if (key !== '_internal' && !key.startsWith('_')) {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * Internal log entry (includes _internal block)
   */
  toLogEntry(context?: ApiErrorContext): Record<string, unknown> {
    const logEntry: Record<string, unknown> = {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        correlationId: this.correlationId,
        timestamp: this.timestamp,
        statusCode: this.statusCode,
        stack: this.stack,
        ...(Object.keys(this.details).length > 0 ? { details: this.details } : {}),
      },
      _internal: {
        organizationId: context?.organizationId || this.context?.organizationId,
        userId: context?.userId || this.context?.userId,
        functionName: context?.functionName || this.context?.functionName,
        executionTimeMs: context?.executionTimeMs || this.context?.executionTimeMs,
        errorCode: this.code,
        timestamp: this.timestamp,
      },
    };

    return logEntry;
  }
}

function generateCorrelationId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Convert unknown error to ApiError
 */
export function apiErrorFromUnknown(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof Error) {
    return new ApiError('INTERNAL_ERROR', 500, error.message, {
      cause: error,
    });
  }

  return new ApiError('INTERNAL_ERROR', 500, 'An unexpected error occurred', {
    details: { originalError: String(error) },
  });
}

/**
 * Type guard for ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export { generateCorrelationId };
