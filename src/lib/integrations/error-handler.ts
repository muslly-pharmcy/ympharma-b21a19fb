/**
 * Error Handling Integration
 * Bridges the new api-error with existing error handling
 */

import { ApiError, apiErrorFromUnknown, isApiError, type ErrorCode } from '../errors/api-error';
import { logInternalError } from '../api/response';
import { redactSensitive } from '../observability/logger.server';

export interface ErrorContext {
  organizationId?: string;
  userId?: string;
  functionName?: string;
  requestPath?: string;
  requestMethod?: string;
}

/**
 * Wrap any function with error handling and logging
 */
export async function withErrorLogging<T>(
  fn: () => Promise<T>,
  context: ErrorContext
): Promise<T> {
  const startTime = Date.now();
  try {
    return await fn();
  } catch (err) {
    const executionTimeMs = Date.now() - startTime;
    logInternalError(err, { ...context, executionTimeMs });
    throw err;
  }
}

/**
 * Create a safe API handler that logs errors internally
 * but returns clean responses to client
 */
export function createSafeHandler<T>(
  handler: (req: Request) => Promise<T>,
  context: ErrorContext
) {
  return async (req: Request) => {
    try {
      const result = await handler(req);
      return { success: true, data: result };
    } catch (err) {
      const apiError = apiErrorFromUnknown(err);
      logInternalError(err, {
        ...context,
        requestPath: req.url,
        requestMethod: req.method,
      });
      return apiError.toJSON();
    }
  };
}

/**
 * Redact sensitive data from any object before logging or responding
 */
export function safeRedact<T>(data: T): T {
  return redactSensitive(data);
}

export { ApiError, apiErrorFromUnknown, isApiError, type ErrorCode, logInternalError, redactSensitive };
