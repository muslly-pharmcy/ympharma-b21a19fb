/**
 * Input Sanitization Module
 * Unicode NFKC normalization + length limits + sanitizers
 */

// Length limits
export const LENGTH_LIMITS = {
  search: 100,
  name: 200,
  email: 254,
  phone: 15,
  description: 2000,
  notes: 5000,
} as const;

/**
 * Unicode NFKC normalization
 */
export function normalizeUnicode(input: string): string {
  if (typeof input !== 'string') return '';
  return input.normalize('NFKC');
}

/**
 * Trim and normalize whitespace
 */
export function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

/**
 * Remove null bytes and control characters (except newline/tab)
 */
export function removeControlChars(input: string): string {
  return input.replace(/\p{Cc}/gu, (character) =>
    character === '\n' || character === '\t' ? character : '',
  );
}

/**
 * Truncate to max length
 */
export function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) return input;
  return input.substring(0, maxLength);
}

/**
 * Sanitize search input
 */
export function search(input: string): string {
  let result = normalizeUnicode(input);
  result = removeControlChars(result);
  result = normalizeWhitespace(result);
  result = truncate(result, LENGTH_LIMITS.search);
  return result;
}

/**
 * Sanitize name input
 */
export function name(input: string): string {
  let result = normalizeUnicode(input);
  result = removeControlChars(result);
  result = normalizeWhitespace(result);
  // Allow letters, numbers, spaces, hyphens, apostrophes
  result = result.replace(/[^\p{L}\p{N}\s\-'']/gu, '');
  result = truncate(result, LENGTH_LIMITS.name);
  return result;
}

/**
 * Sanitize email input
 */
export function email(input: string): string {
  let result = normalizeUnicode(input);
  result = removeControlChars(result);
  result = normalizeWhitespace(result);
  result = result.toLowerCase();
  result = truncate(result, LENGTH_LIMITS.email);
  return result;
}

/**
 * Sanitize phone input
 */
export function phone(input: string): string {
  let result = normalizeUnicode(input);
  result = removeControlChars(result);
  // Remove all non-digit characters
  result = result.replace(/\D/g, '');
  result = truncate(result, LENGTH_LIMITS.phone);
  return result;
}

/**
 * Sanitize description input
 */
export function description(input: string): string {
  let result = normalizeUnicode(input);
  result = removeControlChars(result);
  result = normalizeWhitespace(result);
  result = truncate(result, LENGTH_LIMITS.description);
  return result;
}

/**
 * Sanitize notes input
 */
export function notes(input: string): string {
  let result = normalizeUnicode(input);
  result = removeControlChars(result);
  result = normalizeWhitespace(result);
  result = truncate(result, LENGTH_LIMITS.notes);
  return result;
}

/**
 * Generic sanitizer with options
 */
export interface SanitizeOptions {
  maxLength?: number;
  allowHtml?: boolean;
  allowedTags?: string[];
}

export function sanitize(input: string, options: SanitizeOptions = {}): string {
  let result = normalizeUnicode(input);
  result = removeControlChars(result);
  result = normalizeWhitespace(result);

  if (!options.allowHtml) {
    result = result.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  if (options.maxLength) {
    result = truncate(result, options.maxLength);
  }

  return result;
}

