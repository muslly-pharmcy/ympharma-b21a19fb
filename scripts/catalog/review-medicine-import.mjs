/**
 * YmPharma medicine catalog intake PRE-FLIGHT ONLY.
 * Never connects to Supabase, posts stock, or silently approves medical data.
 * Usage: node scripts/catalog/review-medicine-import.mjs path.csv --out review.json
 */
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const COLUMN_ALIASES = {
  name: ['trade_name', 'name_ar', 'name', 'product_name', 'اسم الصنف', 'الاسم التجاري'],
  generic: ['scientific_name', 'generic_name', 'active_ingredient', 'المادة العلمية', 'الاسم العلمي'],
  barcode: ['barcode', 'bar_code', 'ean', 'باركود', 'الباركود'],
  manufacturer: ['manufacturer', 'company', 'الشركة المصنعة', 'الشركة'],
  strength: ['strength', 'concentration', 'التركيز'],
  form: ['dosage_form', 'form', 'الشكل الصيدلاني'],
  pack: ['pack_unit', 'packaging', 'unit', 'وحدة العبوة', 'الوحدة', 'العبوة'],
  factor: ['conversion_factor', 'pack_factor', 'units_per_pack', 'معامل التحويل'],
  currency: ['currency', 'price_currency', 'العملة'],
  buy: ['purchase_price', 'buy_price', 'cost', 'سعر الشراء'],
  sell: ['selling_price', 'sale_price', 'retail_price', 'سعر البيع'],
  rx: ['requires_prescription', 'prescription', 'بوصفة', 'يحتاج وصفة'],
  controlled: ['controlled', 'is_controlled', 'خاضع للرقابة', 'مراقب'],
}

export function normalizeArabic(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function field(row, key) {
  for (const name of COLUMN_ALIASES[key]) {
    const value = row[name]
    if (value !== undefined && value !== null && String(value).trim() !== '') return value
  }
  return undefined
}

function asciiNumber(value) {
  return String(value ?? '').replace(/[٠-٩]/g, ch => String(ch.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, ch => String(ch.charCodeAt(0) - 0x6f0)).trim()
}

function numeric(value) {
  const s = asciiNumber(value)
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function medicalBoolean(value) {
  if (typeof value === 'boolean') return value
  if (value === 1 || value === 0) return Boolean(value)
  const v = normalizeArabic(value)
  if (['yes', 'true', '1', 'نعم', 'مطلوب', 'مراقب'].includes(v)) return true
  if (['no', 'false', '0', 'لا', 'غير مطلوب', 'غير مراقب'].includes(v)) return false
  return null
}

export function reviewMedicineRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError('Expected an array of source rows')
  const out = []
  const seenBarcodes = new Map()
  const seenIdentities = new Map()
  const add = (record, severity, code) => {
    if (!record.findings.some(x => x.code === code)) record.findings.push({ severity, code })
  }
  for (const [index, raw] of rows.entries()) {
    const row = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
    const record = { row: index + 2, findings: [] }
    out.push(record)
    const name = normalizeArabic(field(row, 'name'))
    const generic = normalizeArabic(field(row, 'generic'))
    const manufacturer = normalizeArabic(field(row, 'manufacturer'))
    const strength = normalizeArabic(field(row, 'strength'))
    const form = normalizeArabic(field(row, 'form'))
    const barcode = asciiNumber(field(row, 'barcode')).replace(/\s/g, '')
    const pack = normalizeArabic(field(row, 'pack'))
    if (!name) add(record, 'BLOCK', 'MISSING_TRADE_NAME')
    if (!generic) add(record, 'REVIEW', 'MISSING_GENERIC_NAME')
    if (!manufacturer) add(record, 'REVIEW', 'MISSING_MANUFACTURER')
    if (!pack) add(record, 'REVIEW', 'MISSING_PACK_UNIT')
    if (!barcode) add(record, 'REVIEW', 'MISSING_BARCODE')
    else if (!/^\d{8,14}$/.test(barcode)) add(record, 'REVIEW', 'BARCODE_FORMAT_UNVERIFIED')
    if (barcode) {
      const previous = seenBarcodes.get(barcode)
      if (previous) {
        add(record, 'BLOCK', 'DUPLICATE_BARCODE')
        add(previous, 'BLOCK', 'DUPLICATE_BARCODE')
      } else seenBarcodes.set(barcode, record)
    }
    // Identity collisions are flagged, never automatically merged.
    if (name) {
      const identity = [name, manufacturer, strength, form, pack].join('|')
      const previous = seenIdentities.get(identity)
      if (previous) {
        add(record, 'REVIEW', 'DUPLICATE_NORMALIZED_IDENTITY')
        add(previous, 'REVIEW', 'DUPLICATE_NORMALIZED_IDENTITY')
      } else seenIdentities.set(identity, record)
    }
    const factorRaw = field(row, 'factor')
    const factor = numeric(factorRaw)
    if (factorRaw === undefined) add(record, 'REVIEW', 'MISSING_CONVERSION_FACTOR')
    else if (factor === null || factor <= 0 || !Number.isInteger(factor)) {
      add(record, 'BLOCK', 'INVALID_CONVERSION_FACTOR')
    }
    const currencyRaw = field(row, 'currency')
    const currency = String(currencyRaw ?? '').trim().toUpperCase()
    if (!currency) add(record, 'REVIEW', 'MISSING_CURRENCY')
    else if (!['YER','SAR','USD'].includes(currency)) add(record, 'BLOCK', 'UNKNOWN_CURRENCY')
    for (const key of ['buy','sell']) {
      const priceRaw = field(row, key)
      const price = numeric(priceRaw)
      if (priceRaw === undefined) add(record, 'REVIEW', key === 'buy' ? 'MISSING_PURCHASE_PRICE' : 'MISSING_SELLING_PRICE')
      else if (price === null || price <= 0) add(record, 'REVIEW', key === 'buy' ? 'PURCHASE_PRICE_REQUIRES_REVIEW' : 'SELLING_PRICE_REQUIRES_REVIEW')
      else if (asciiNumber(priceRaw).split('.')[1]?.length > 4) add(record, 'REVIEW', 'PRICE_PRECISION_OVER_FOUR')
    }
    if (medicalBoolean(field(row, 'rx')) === null) add(record, 'REVIEW', 'PRESCRIPTION_FLAG_UNVERIFIED')
    if (medicalBoolean(field(row, 'controlled')) === null) add(record, 'REVIEW', 'CONTROLLED_FLAG_UNVERIFIED')
  }
  const count = code => out.filter(r => r.findings.some(f => f.code === code)).length
  const blocked = out.filter(r => r.findings.some(f => f.severity === 'BLOCK')).length
  const review = out.filter(r => r.findings.some(f => f.severity === 'REVIEW')).length
  return {
    safe_to_import_automatically: false,
    approval_required: true,
    summary: {
      total: out.length,
      blocked,
      needs_review: review,
      missing_barcodes: count('MISSING_BARCODE'),
      missing_generic: count('MISSING_GENERIC_NAME'),
      missing_pack_units: count('MISSING_PACK_UNIT'),
      invalid_factors: count('INVALID_CONVERSION_FACTOR'),
      duplicate_barcodes: count('DUPLICATE_BARCODE'),
      duplicate_identities: count('DUPLICATE_NORMALIZED_IDENTITY'),
    },
    rows: out,
  }
}

export function parseCsv(text) {
  const source = String(text).replace(/^\uFEFF/, '')
  const firstLine = source.split(/\r?\n/, 1)[0]
  const separator = firstLine.split(';').length > firstLine.split(',').length ? ';' : ','
  const result = []
  let current = '', row = [], quoted = false
  for (let i = 0; i < source.length; i++) {
    const c = source[i]
    if (c === '"') {
      if (quoted && source[i + 1] === '"') { current += '"'; i++ }
      else quoted = !quoted
    } else if (!quoted && c === separator) { row.push(current); current = '' }
    else if (!quoted && (c === '\r' || c === '\n')) {
      if (c === '\r' && source[i + 1] === '\n') i++
      row.push(current); result.push(row); row = []; current = ''
    } else current += c
  }
  if (quoted) throw new Error('Malformed CSV: unclosed quoted field')
  if (current !== '' || row.length) { row.push(current); result.push(row) }
  const header = (result.shift() ?? []).map(x => x.trim())
  if (!header.length) throw new Error('CSV header is empty')
  return result.filter(cells => cells.some(v => String(v).trim())).map(cells =>
    Object.fromEntries(header.map((key, i) => [key, cells[i] ?? '']))
  )
}

export async function readMedicineSource(inputPath) {
  const absolute = resolve(inputPath)
  if (statSync(absolute).size > 32 * 1024 * 1024) throw new Error('File exceeds 32 MiB safety limit')
  const ext = extname(absolute).toLowerCase()
  if (ext === '.csv') return parseCsv(readFileSync(absolute, 'utf8'))
  if (ext === '.json') {
    const input = JSON.parse(readFileSync(absolute, 'utf8'))
    const rows = Array.isArray(input) ? input : input.rows ?? input.records
    if (!Array.isArray(rows)) throw new Error('JSON must contain array, rows[] or records[]')
    return rows
  }
  if (ext === '.xlsx' || ext === '.xls') {
    const xlsx = await import('xlsx')
    const book = xlsx.read(readFileSync(absolute), { type: 'buffer', cellDates: false })
    return xlsx.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: '' })
  }
  throw new Error('Supported input formats: .csv, .json, .xlsx, .xls')
}

async function main() {
  const input = process.argv[2]
  if (!input || input.startsWith('-')) {
    throw new Error('Usage: node scripts/catalog/review-medicine-import.mjs <input> [--out report.json]')
  }
  const rows = await readMedicineSource(input)
  const report = reviewMedicineRows(rows)
  const outAt = process.argv.indexOf('--out')
  if (outAt !== -1) {
    const filename = process.argv[outAt + 1]
    if (!filename) throw new Error('--out requires a file path')
    writeFileSync(resolve(filename), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' })
  }
  console.log(JSON.stringify(report.summary, null, 2))
  console.log('Automatic database import is DISABLED; every row requires reviewed approval.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(e => { console.error(e.message); process.exitCode = 1 })
}
