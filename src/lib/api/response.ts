/**
 * API Response Helpers with Internal Error Logging
 */

import { ApiError, apiErrorFromUnknown, isApiError } from '../errors/api-error';
import { redactSensitive } from '../observability/logger.server';

export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    correlationId: string;
    timestamp: string;
    details?: Record<string, unknown>;
  };
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

/**
 * Create success response
 */
export function success<T>(data: T, meta?: SuccessResponse<T>['meta']): SuccessResponse<T> {
  return {
    success: true,
    data,
    ...(meta ? { meta } : {}),
  };
}

/**
 * Create error response (client-safe)
 */
export function error(apiError: ApiError): ErrorResponse {
  return apiError.toJSON() as unknown as ErrorResponse;
}

/**
 * Log internal error with full metadata (never sent to client)
 */
export function logInternalError(
  err: unknown,
  context: {
    organizationId?: string;
    userId?: string;
    functionName?: string;
    executionTimeMs?: number;
    requestPath?: string;
    requestMethod?: string;
  }
): void {
  const apiError = apiErrorFromUnknown(err);
  const logEntry = apiError.toLogEntry({
    organizationId: context.organizationId,
    userId: context.userId,
    functionName: context.functionName,
    executionTimeMs: context.executionTimeMs,
  });

  // Add request context
  const internalBlock = (logEntry._internal ?? {}) as Record<string, unknown>;
  const fullLog = {
    ...logEntry,
    _internal: {
      ...internalBlock,
      requestPath: context.requestPath,
      requestMethod: context.requestMethod,
      environment: process.env.NODE_ENV || 'unknown',
    },
  };

  // Redact sensitive data before logging
  const safeLog = redactSensitive(fullLog);

  console.error('[INTERNAL_ERROR]', JSON.stringify(safeLog, null, 2));
}

/**
 * Handle API errors consistently
 */
export function handleApiError(err: unknown): ErrorResponse {
  const apiError = apiErrorFromUnknown(err);
  return error(apiError);
}

/**
 * Wrap async handler with error handling
 */
export function withErrorHandling<T>(
  handler: () => Promise<T>,
  context: Parameters<typeof logInternalError>[1]
): Promise<ApiResponse<T>> {
  const startTime = Date.now();

  return handler()
    .then((data) => success(data))
    .catch((err) => {
      const executionTimeMs = Date.now() - startTime;
      logInternalError(err, { ...context, executionTimeMs });
      return handleApiError(err);
    });
}

export { ApiError, apiErrorFromUnknown, isApiError };
