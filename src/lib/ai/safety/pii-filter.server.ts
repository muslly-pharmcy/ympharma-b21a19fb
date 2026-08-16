/**
 * PII Filter for AI Safety
 * Detects and redacts 10 types of PII before sending to AI providers
 */

import { redactText, textContainsPII } from '@/lib/observability/pii-patterns';

// PII detection patterns
const PII_PATTERNS: Record<string, RegExp> = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/g,
  credit_card: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
  ip: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
  iban: /\b[A-Z]{2}\d{2}\s?(?:\d{4}\s?){4,7}\d{1,4}\b/g,
  passport: /\b[A-Z]{1,2}\d{6,9}\b/g,
  mrn: /\bMRN[-\s]?\d{6,12}\b/gi,
  national_id: /\b\d{9,12}\b/g,
};

// PII type labels
export type PIIType = 'email' | 'phone' | 'credit_card' | 'ssn' | 'ip' | 'iban' | 'passport' | 'mrn' | 'national_id';

export interface PIIDetection {
  type: PIIType;
  value: string;
  position: [number, number];
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Detect all PII in text
 */
export function detectPII(text: string): PIIDetection[] {
  const detections: PIIDetection[] = [];

  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match.index !== undefined) {
        const confidence = getConfidence(type as PIIType, match[0]);
        detections.push({
          type: type as PIIType,
          value: match[0],
          position: [match.index, match.index + match[0].length],
          confidence,
        });
      }
    }
  }

  // Sort by position (descending) for replacement
  return detections.sort((a, b) => b.position[0] - a.position[0]);
}

function getConfidence(type: PIIType, value: string): 'high' | 'medium' | 'low' {
  switch (type) {
    case 'email':
    case 'iban':
      return 'high';
    case 'credit_card':
      return luhnCheck(value.replace(/\D/g, '')) ? 'high' : 'medium';
    case 'ssn':
      return value.replace(/\D/g, '').length === 9 ? 'high' : 'medium';
    case 'phone':
      return value.replace(/\D/g, '').length >= 10 ? 'high' : 'medium';
    case 'passport':
      return /^[A-Z]{1,2}\d{6,9}$/.test(value) ? 'high' : 'medium';
    case 'mrn':
      return /^MRN[-\s]?\d{6,12}$/i.test(value) ? 'high' : 'medium';
    case 'national_id':
      return /^\d{9,12}$/.test(value) ? 'medium' : 'low';
    case 'ip':
      return 'high';
    default:
      return 'low';
  }
}

/**
 * Simple Luhn check for credit card validation
 */
function luhnCheck(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits.substring(i, i + 1), 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

/**
 * Redact PII from text.
 *
 * Two passes: the structural patterns above, then the shared high-confidence
 * text patterns (patient names, MRNs, Rx codes, bearer tokens) used by the
 * server logger, so AI prompts and logs never drift apart.
 */
export function redactPII(text: string, replacement = '[REDACTED]'): string {
  const detections = detectPII(text);
  let result = text;

  for (const detection of detections) {
    const before = result.substring(0, detection.position[0]);
    const after = result.substring(detection.position[1]);
    result = before + replacement + after;
  }

  return redactText(result);
}

/**
 * Alias for sanitizeForAI
 */
export const sanitizeForAI = redactPII;


/**
 * Check if text contains any PII
 */
export function containsPII(text: string): boolean {
  return detectPII(text).length > 0 || textContainsPII(text);
}


/**
 * Get PII summary for analytics
 */
export function getPIISummary(text: string): Record<PIIType, number> {
  const detections = detectPII(text);
  const summary: Partial<Record<PIIType, number>> = {};

  for (const detection of detections) {
    summary[detection.type] = (summary[detection.type] || 0) + 1;
  }

  return summary as Record<PIIType, number>;
}

export { PII_PATTERNS };
