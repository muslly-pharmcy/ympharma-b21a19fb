#!/usr/bin/env node
// Seed script — one-time import of the SBDMA-style Excel product file into
// public.catalog_products (upsert on organization_id + store_code).
//
// Requires PG env vars (PGHOST/PGUSER/PGPASSWORD/PGDATABASE) and a CSV at
// the given path. Convert the source .xls to CSV first:
//
//   python3 -c "import pandas as pd; \
//     pd.read_excel('الاصناف2030.xls').to_csv('/tmp/asnaf.csv', index=False)"
//
// Then run:
//   node scripts/seed-store-products.mjs /tmp/asnaf.csv <ORG_UUID>
//
// The default org UUID matches "Aden Public Healthcare Directory".

import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const [, , csvPath, orgArg] = process.argv
if (!csvPath) {
  console.error('usage: node scripts/seed-store-products.mjs <csv> [orgUuid]')
  process.exit(1)
}
const ORG = orgArg ?? '11111111-1111-1111-1111-000000000001'

function parseCsv(text) {
  const rows = []
  let cur = [], field = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') inQ = false
      else field += c
    } else {
      if (c === '"') inQ = true
      else if (c === ',') { cur.push(field); field = '' }
      else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = '' }
      else if (c === '\r') { /* skip */ }
      else field += c
    }
  }
  if (field || cur.length) { cur.push(field); rows.push(cur) }
  return rows
}

const raw = readFileSync(csvPath, 'utf8')
const rows = parseCsv(raw).filter((r) => r.some((c) => c && c.trim()))
const header = rows.shift()
console.log('columns:', header)

// Arabic header mapping (from الاصناف2030.xls)
const idx = {
  code: header.findIndex((h) => h.includes('الكـود') || h.includes('الكود')),
  name: header.findIndex((h) => h.includes('اســم') || h.includes('اسم الصنف') || h.includes('الصـــنف')),
  balance: header.findIndex((h) => h.includes('الرصيــــد') || h.includes('الرصيد')),
  unit: header.findIndex((h) => h.includes('الوحــدة') || h.includes('الوحدة')),
  expiry: header.findIndex((h) => h.includes('الإنتهاء') || h.includes('الانتهاء')),
  supplier: header.findIndex((h) => h.includes('المــــــــورد') || h.includes('المورد')),
  price: header.findIndex((h) => h.includes('القيمــــــة') || h.includes('القيمة')),
}
if (idx.code < 0 || idx.name < 0) {
  console.error('missing required columns; got indexes', idx)
  process.exit(1)
}

const records = rows.map((r) => {
  const codeRaw = (r[idx.code] ?? '').toString().trim()
  const code = codeRaw && codeRaw !== 'nan' ? codeRaw.replace(/\.0$/, '') : null
  const name = (r[idx.name] ?? '').toString().trim()
  const balance = Number(r[idx.balance] ?? 0) || 0
  const unit = idx.unit >= 0 ? (r[idx.unit] ?? '').toString().trim() : null
  const supplier = idx.supplier >= 0 ? (r[idx.supplier] ?? '').toString().trim() : null
  const price = idx.price >= 0 ? Number(r[idx.price] ?? 0) || null : null
  return { code, name, balance, unit, supplier, price }
}).filter((r) => r.code && r.name)

console.log('valid rows:', records.length)

// Write COPY-friendly TSV and bulk-load via psql
const escape = (v) => (v == null ? '\\N' : String(v).replace(/\\/g, '\\\\').replace(/\t/g, ' ').replace(/\n/g, ' '))
const tsvLines = records.map((r) => [
  ORG, r.code, r.name, escape(r.unit), escape(r.supplier), r.price ?? '\\N',
].join('\t'))

import { writeFileSync } from 'node:fs'
writeFileSync('/tmp/seed-store.tsv', tsvLines.join('\n'))

const sql = `
BEGIN;
CREATE TEMP TABLE _stage (
  organization_id uuid,
  store_code text,
  name text,
  pack_unit text,
  supplier_name_text text,
  sbdma_official_price numeric
);
\\COPY _stage FROM '/tmp/seed-store.tsv' WITH (FORMAT text, DELIMITER E'\\t', NULL '\\N');

-- Insert new rows
INSERT INTO public.catalog_products
  (organization_id, owner_org_id, name_ar, store_code, pack_unit,
   supplier_name_text, sbdma_official_price, status, is_public)
SELECT s.organization_id, s.organization_id, s.name, s.store_code, s.pack_unit,
       s.supplier_name_text, s.sbdma_official_price, 'approved', true
FROM _stage s
LEFT JOIN public.catalog_products p
  ON p.organization_id = s.organization_id AND p.store_code = s.store_code
WHERE p.id IS NULL;

-- Update existing (by org + store_code)
UPDATE public.catalog_products p SET
  name_ar = s.name,
  pack_unit = s.pack_unit,
  supplier_name_text = s.supplier_name_text,
  sbdma_official_price = COALESCE(s.sbdma_official_price, p.sbdma_official_price),
  updated_at = now()
FROM _stage s
WHERE p.organization_id = s.organization_id AND p.store_code = s.store_code;

COMMIT;
`
writeFileSync('/tmp/seed-store.sql', sql)
console.log('running psql…')
execSync(`psql -v ON_ERROR_STOP=1 -f /tmp/seed-store.sql`, { stdio: 'inherit' })
console.log('done.')
