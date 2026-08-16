/**
 * Upload Validation Integration
 * Bridges the new upload validation with existing file upload handlers
 */

import { validateUpload, quickValidate, detectMagicNumber, type FileValidationResult } from '../upload/validation.server';

export interface UploadOptions {
  maxSize?: number;
  allowedTypes?: string[];
  requireMagicNumber?: boolean;
}

/**
 * Validate file before processing upload
 * Returns { valid: true } or { valid: false, error: string }
 */
export async function validateFileUpload(
  file: File,
  _options: UploadOptions = {}
): Promise<FileValidationResult> {
  return await validateUpload(file);
}

/**
 * Quick pre-validation before reading file content
 */
export function quickValidateUpload(
  filename: string,
  mimeType: string,
  size: number
): FileValidationResult {
  return quickValidate(filename, mimeType, size);
}

/**
 * Check if buffer has valid magic number
 */
export function checkMagicNumber(buffer: Buffer): string | null {
  return detectMagicNumber(buffer);
}

export { validateUpload, quickValidate, detectMagicNumber, type FileValidationResult };
