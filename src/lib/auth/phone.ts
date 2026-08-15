/**
 * Phone normalization for Supabase Auth (E.164), Yemen-first.
 *
 * No hand-maintained prefix allow-list: any number whose national part has a
 * plausible length is accepted and normalized. Supabase Auth / the SMS provider
 * remains the authority on deliverability.
 */

export const DEFAULT_COUNTRY_CODE = '967'

const ARABIC_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/g

/** Convert Arabic-Indic digits to ASCII and drop formatting characters. */
export function toAsciiDigits(raw: string): string {
  return raw.replace(ARABIC_DIGITS, (d) => {
    const code = d.charCodeAt(0)
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660
    return String(code - base)
  })
}

/**
 * Normalize a user-entered phone number to E.164.
 * Returns null when the input cannot be a valid international number.
 */
export function normalizePhone(raw: string, defaultCountry = DEFAULT_COUNTRY_CODE): string | null {
  if (typeof raw !== 'string') return null
  const ascii = toAsciiDigits(raw).trim()
  if (!/^[+\d\s()\-.]+$/.test(ascii) || ascii.length === 0) return null

  const hadPlus = ascii.trimStart().startsWith('+') || ascii.trimStart().startsWith('00')
  let digits = ascii.replace(/\D/g, '')
  if (ascii.trimStart().startsWith('00')) digits = digits.slice(2)

  if (!digits) return null

  if (!hadPlus) {
    // Local format: strip a single leading trunk zero, then prepend the country code.
    const national = digits.replace(/^0+/, '')
    if (national.length < 7 || national.length > 12) return null
    digits = `${defaultCountry}${national}`
  }

  if (digits.length < 8 || digits.length > 15) return null
  return `+${digits}`
}

export function isValidPhone(raw: string, defaultCountry = DEFAULT_COUNTRY_CODE): boolean {
  return normalizePhone(raw, defaultCountry) !== null
}

/** Heuristic used by the unified login field to route identifier → phone or email. */
export function looksLikeEmail(raw: string): boolean {
  return /@/.test(raw)
}
