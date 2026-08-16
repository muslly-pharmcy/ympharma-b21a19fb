/**
 * Upload Validation Server Module
 * Security hardening: magic number validation, double extension rejection, executable blocklist
 */

// Magic numbers for common file types
const MAGIC_NUMBERS: Record<string, number[]> = {
  png: [0x89, 0x50, 0x4E, 0x47],
  jpg: [0xFF, 0xD8, 0xFF],
  jpeg: [0xFF, 0xD8, 0xFF],
  pdf: [0x25, 0x50, 0x44, 0x46],
  zip: [0x50, 0x4B, 0x03, 0x04],
};

// Executable file extensions blocklist
const EXECUTABLE_BLOCKLIST = new Set([
  'exe', 'dll', 'bat', 'cmd', 'ps1', 'sh', 'msi', 'apk', 'jar', 'com',
  'scr', 'vbs', 'js', 'wsf', 'app', 'dmg', 'pkg', 'deb', 'rpm',
]);

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_MIME_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/jpg', 'application/pdf',
  'application/zip', 'application/x-zip-compressed',
]);

// Allowed extensions
const ALLOWED_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'pdf', 'zip',
]);

/**
 * Detect magic number from file buffer
 */
export function detectMagicNumber(buffer: Buffer): string | null {
  for (const [type, magic] of Object.entries(MAGIC_NUMBERS)) {
    if (buffer.length >= magic.length) {
      let match = true;
      for (let i = 0; i < magic.length; i++) {
        if (buffer[i] !== magic[i]) {
          match = false;
          break;
        }
      }
      if (match) return type;
    }
  }
  return null;
}

/**
 * Check for double extension attack (e.g., invoice.pdf.exe)
 */
function hasDoubleExtension(filename: string): boolean {
  const parts = filename.split('.');
  // If more than 2 parts and the last part is an executable
  if (parts.length > 2) {
    const lastExt = parts[parts.length - 1].toLowerCase();
    if (EXECUTABLE_BLOCKLIST.has(lastExt)) {
      return true;
    }
  }
  return false;
}

/**
 * Log security audit event
 */
function auditLog(event: string, details: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  console.error(`[AUDIT][${timestamp}] ${event}`, JSON.stringify(details));
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedType?: string | null;
}

/**
 * Validate uploaded file with full security checks
 */
export async function validateUpload(
  file: File | { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> }
): Promise<FileValidationResult> {
  const filename = file.name;
  const mimeType = file.type;
  const size = file.size;

  // 1. Check file size
  if (size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File exceeds maximum size of 10MB' };
  }

  // 2. Check for double extension
  if (hasDoubleExtension(filename)) {
    auditLog('DOUBLE_EXTENSION_REJECTED', { filename, mimeType });
    return { valid: false, error: 'Double extension files are not allowed' };
  }

  // 3. Extract extension
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  // 4. Check executable blocklist
  if (EXECUTABLE_BLOCKLIST.has(ext)) {
    auditLog('EXECUTABLE_BLOCKED', { filename, ext });
    return { valid: false, error: `Executable files (.${ext}) are not allowed` };
  }

  // 5. Check allowed extension
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `File type .${ext} is not allowed` };
  }

  // 6. Check MIME type
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { valid: false, error: `MIME type ${mimeType} is not allowed` };
  }

  // 7. Magic number validation
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const detectedType = detectMagicNumber(buffer);

    if (detectedType && detectedType !== ext && !(ext === 'jpg' && detectedType === 'jpeg')) {
      auditLog('MAGIC_NUMBER_MISMATCH', {
        filename,
        claimedType: ext,
        detectedType,
        mimeType,
      });
      return {
        valid: false,
        error: `File type mismatch: claimed .${ext} but detected as .${detectedType}`,
        detectedType,
      };
    }

    return { valid: true, detectedType };
  } catch (err) {
    auditLog('MAGIC_NUMBER_READ_ERROR', { filename, error: String(err) });
    return { valid: false, error: 'Unable to validate file content' };
  }
}

/**
 * Quick validation without reading file content (for pre-checks)
 */
export function quickValidate(filename: string, mimeType: string, size: number): FileValidationResult {
  if (size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File exceeds maximum size of 10MB' };
  }
  if (hasDoubleExtension(filename)) {
    return { valid: false, error: 'Double extension files are not allowed' };
  }
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (EXECUTABLE_BLOCKLIST.has(ext)) {
    return { valid: false, error: `Executable files (.${ext}) are not allowed` };
  }
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `File type .${ext} is not allowed` };
  }
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { valid: false, error: `MIME type ${mimeType} is not allowed` };
  }
  return { valid: true };
}

export { MAGIC_NUMBERS, EXECUTABLE_BLOCKLIST, MAX_FILE_SIZE, ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS };
