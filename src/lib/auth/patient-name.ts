/**
 * Three-part patient name handling (الاسم الثلاثي).
 *
 * The name is PROFILE data — never an authentication credential and never a
 * way to identify or merge an existing patient record.
 *
 * Validation is deliberately permissive about Arabic orthography: every Arabic
 * letter variant (أ إ آ ؤ ئ ى ة), tatweel and diacritics are accepted, as are
 * Latin letters for non-Arabic names. Only clearly invalid input is rejected.
 */

export interface ThreePartName {
  firstName: string
  fatherName: string
  familyName: string
}

export const NAME_PART_MAX = 40

export const NAME_LABELS_AR: Record<keyof ThreePartName, string> = {
  firstName: 'الاسم الأول',
  fatherName: 'اسم الأب',
  familyName: 'اسم العائلة',
}

export const NAME_ERROR_AR = 'يرجى إدخال الاسم الثلاثي بشكل صحيح.'

/** Arabic letters + diacritics + tatweel, Latin letters, spaces, apostrophes, hyphens. */
const NAME_ALLOWED = /^[\u0621-\u063A\u0640-\u065F\u0670\u06D6-\u06ED\u06FA-\u06FFa-zA-Z'’\-\s]+$/u
const HAS_LETTER = /[\u0621-\u063A\u0641-\u064Aa-zA-Z]/u

/** Trim and collapse repeated whitespace. Spelling is never rewritten. */
export function normalizeNamePart(raw: string): string {
  return raw.replace(/[\s\u00a0\u200f\u200e]+/g, ' ').trim()
}

export function isValidNamePart(raw: string): boolean {
  const value = normalizeNamePart(raw)
  if (value.length < 2 || value.length > NAME_PART_MAX) return false
  if (!NAME_ALLOWED.test(value)) return false
  if (!HAS_LETTER.test(value)) return false
  return true
}

export interface NameValidationResult {
  ok: boolean
  /** Field keys that failed validation. */
  invalid: Array<keyof ThreePartName>
  value: ThreePartName
  fullName: string
}

export function validateThreePartName(input: Partial<ThreePartName>): NameValidationResult {
  const value: ThreePartName = {
    firstName: normalizeNamePart(input.firstName ?? ''),
    fatherName: normalizeNamePart(input.fatherName ?? ''),
    familyName: normalizeNamePart(input.familyName ?? ''),
  }
  const invalid = (Object.keys(value) as Array<keyof ThreePartName>).filter(
    (key) => !isValidNamePart(value[key]),
  )
  return { ok: invalid.length === 0, invalid, value, fullName: buildFullName(value) }
}

export function buildFullName(value: Partial<ThreePartName>): string {
  return [value.firstName, value.fatherName, value.familyName]
    .map((part) => normalizeNamePart(part ?? ''))
    .filter(Boolean)
    .join(' ')
}
