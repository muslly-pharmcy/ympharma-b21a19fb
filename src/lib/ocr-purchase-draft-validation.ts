/**
 * Fail-closed validation for purchase-order drafts created from untrusted OCR.
 *
 * All amounts are handled as decimal strings with bigint intermediate arithmetic:
 * 3dp quantity, 4dp cost, and 4dp total (purchase_orders NUMERIC(14,4)).
 * No fallback quantity/cost values or auto-posting are allowed here.
 */
export interface OcrPurchaseRow {
  row_index: number
  decision: string
  matched_product_id: string | null
  payload: Record<string, unknown> | null
}

export interface OcrDraftPurchaseLine {
  line_no: number
  product_id: string
  qty_ordered: string
  unit_cost: string
  batch_no: string | null
  expiry_date: string | null
}

export type OcrDraftValidation =
  | { ok: true; lines: OcrDraftPurchaseLine[]; totalAmount: string; skipped: number }
  | { ok: false; errors: Array<{ rowIndex: number; reason: string }> }

function decimal(value: unknown, scale: number, mustBePositive: boolean): bigint | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  if (typeof value === 'number' && !Number.isFinite(value)) return null
  const str = String(value).trim()
  const found = /^(0|[1-9]\d{0,9})(?:\.(\d+))?$/.exec(str)
  if (!found || (found[2]?.length ?? 0) > scale) return null
  const integer = BigInt(found[1]!)
  const fraction = BigInt((found[2] ?? '').padEnd(scale, '0') || '0')
  const fixed = integer * (10n ** BigInt(scale)) + fraction
  return mustBePositive && fixed <= 0n ? null : fixed
}

function fixedString(amount: bigint, scale: number): string {
  const factor = 10n ** BigInt(scale)
  return (amount / factor).toString() + '.' + (amount % factor).toString().padStart(scale, '0')
}

function safeDate(raw: unknown): string | null | undefined {
  if (raw == null || raw === '') return null
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined
  const date = new Date(raw + 'T00:00:00.000Z')
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== raw ? undefined : raw
}

export function validateOcrPurchaseDraft(rows: readonly OcrPurchaseRow[]): OcrDraftValidation {
  const errors: Array<{ rowIndex: number; reason: string }> = []
  const lines: OcrDraftPurchaseLine[] = []
  let totalAt7dp = 0n
  for (const row of rows) {
    if (row.decision !== 'matched') continue
    const p = row.payload ?? {}
    const qty = decimal(p['_quantity'], 3, true)
    const cost = decimal(p['_unit_cost'], 4, true)
    const expiry = safeDate(p['_expiry_date'])
    const id = row.matched_product_id
    const rowErrors: string[] = []
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) rowErrors.push('معرف الصنف المطابق غير صالح')
    if (qty === null) rowErrors.push('الكمية غير معروفة أو غير صالحة')
    if (cost === null) rowErrors.push('تكلفة الوحدة غير معروفة أو غير صالحة')
    if (expiry === undefined) rowErrors.push('تاريخ الصلاحية غير صالح')
    if (rowErrors.length) {
      errors.push({ rowIndex: row.row_index, reason: rowErrors.join('، ') })
      continue
    }
    // Validation above establishes non-null decimal quantities and a valid product.
    lines.push({
      line_no: lines.length + 1,
      product_id: id!,
      qty_ordered: fixedString(qty!, 3),
      unit_cost: fixedString(cost!, 4),
      batch_no: typeof p['_batch_no'] === 'string' && p['_batch_no'].trim() ? p['_batch_no'].trim().slice(0, 100) : null,
      expiry_date: expiry ?? null,
    })
    totalAt7dp += qty! * cost!
  }
  if (!lines.length && !errors.length) errors.push({ rowIndex: -1, reason: 'لا توجد أصناف مطابقة في الفاتورة' })
  // Round once at the end, half up, from product scale 7 to total scale 4.
  const roundedTotalAt4dp = (totalAt7dp + 500n) / 1000n
  if (roundedTotalAt4dp > 99999999999999n) errors.push({ rowIndex: -1, reason: 'الإجمالي يتجاوز الحد العددي المسموح' })
  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    lines,
    totalAmount: fixedString(roundedTotalAt4dp, 4),
    skipped: rows.length - lines.length,
  }
}
