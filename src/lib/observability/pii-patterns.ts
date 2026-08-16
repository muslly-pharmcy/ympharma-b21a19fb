/**
 * Isomorphic PII patterns + conservative text redaction.
 *
 * Shared by the AI safety filter (`src/lib/ai/safety/pii-filter.server.ts`)
 * and the server logger (`src/lib/observability/logger.server.ts`) so a single
 * definition governs everything printed to logs or forwarded to external
 * observability tools.
 *
 * Deliberately conservative: only high-confidence shapes are redacted inside
 * free text so ordinary ids, counts and timestamps stay readable in logs.
 */

export type PIITextType =
  | 'email'
  | 'phone'
  | 'credit_card'
  | 'iban'
  | 'mrn'
  | 'national_id'
  | 'rx_code'
  | 'bearer'
  | 'patient_name'

/** High-confidence patterns safe to apply to arbitrary free text. */
export const TEXT_PII_PATTERNS: Record<PIITextType, RegExp> = {
  // name@domain.tld
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  // +967 7xx xxx xxx / 00967… / bare Yemeni & Gulf mobile numbers
  phone: /(?:\+|00)\d{1,3}[\s.-]?\d{2,4}[\s.-]?\d{3}[\s.-]?\d{3,4}\b|\b0?7\d{8}\b|\b05\d{8}\b/g,
  credit_card: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  iban: /\b[A-Z]{2}\d{2}\s?(?:[A-Z0-9]{4}\s?){3,7}[A-Z0-9]{1,4}\b/g,
  mrn: /\b(?:MRN|رقم\s*الملف)[-:\s]?[A-Z0-9-]{4,14}\b/gi,
  // Only when introduced by an identity keyword — avoids eating plain numbers.
  national_id:
    /\b(?:national[_\s-]?id|nid|id[_\s-]?number|رقم\s*(?:الهوية|البطاقة|الوطني))[-:\s]*\d{6,14}\b/gi,
  rx_code: /\b(?:RX|PRESC|وصفة)[-_\s]?[A-Z0-9]{4,16}\b/gi,
  bearer: /\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/g,
  // "patient: Ahmed Ali" / "المريض: أحمد علي"
  patient_name:
    /\b(?:patient(?:[_\s-]?name)?|المريض(?:ة)?|اسم\s*المريض)\s*[:=]\s*[\p{L}][\p{L}\s'.-]{2,60}/giu,
}

export const REDACTION_PLACEHOLDER: Record<PIITextType, string> = {
  email: '[REDACTED_EMAIL]',
  phone: '[REDACTED_PHONE]',
  credit_card: '[REDACTED_CARD]',
  iban: '[REDACTED_IBAN]',
  mrn: '[REDACTED_MRN]',
  national_id: '[REDACTED_ID]',
  rx_code: '[REDACTED_RX]',
  bearer: '[REDACTED_BEARER]',
  patient_name: '[REDACTED_NAME]',
}

/** Redact high-confidence PII shapes inside a free-text string. */
export function redactText(text: string): string {
  if (!text) return text
  let out = text
  for (const [type, pattern] of Object.entries(TEXT_PII_PATTERNS) as Array<
    [PIITextType, RegExp]
  >) {
    // Fresh regex per call: the shared literals carry the /g lastIndex.
    out = out.replace(new RegExp(pattern.source, pattern.flags), REDACTION_PLACEHOLDER[type])
  }
  return out
}

/** True when the text contains at least one high-confidence PII shape. */
export function textContainsPII(text: string): boolean {
  return redactText(text) !== text
}
