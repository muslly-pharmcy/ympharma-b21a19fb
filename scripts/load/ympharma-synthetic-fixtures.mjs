/**
 * Synthetic 30-branch/150-cashier data fixture generator, OFFLINE ONLY.
 * Never connects to the ERP or production systems. Not a load test result.
 * node scripts/load/ympharma-synthetic-fixtures.mjs --invoices 100000 --operations 100000 --out ./tmp/load.jsonl
 */
import { createWriteStream } from 'node:fs'
import { once } from 'node:events'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

function amount(units) {
  const n = BigInt(units)
  return (n / 10000n).toString() + '.' + (n % 10000n).toString().padStart(4, '0')
}
function syntheticId(prefix, i) {
  return prefix + '-' + String(i).padStart(10, '0')
}
export function invoiceFixture(i) {
  if (!Number.isSafeInteger(i) || i < 1) throw new Error('positive index required')
  const base = 250000n + BigInt(i % 1000) * 10000n
  return {
    kind: 'synthetic_invoice',
    idempotency_key: syntheticId('load-invoice', i),
    branch: 'B' + String(((i - 1) % 30) + 1).padStart(2, '0'),
    cashier: 'C' + String(((i - 1) % 150) + 1).padStart(3, '0'),
    currency: 'YER',
    sku: 'SYNTHETIC-NOT-REAL',
    batch_no: 'TEST-LOT',
    qty: 1,
    total: amount(base),
    never_use_as_production_stock: true,
  }
}
export function journalFixture(i) {
  if (!Number.isSafeInteger(i) || i < 1) throw new Error('positive index required')
  const amountUnits = 100000n + BigInt(i % 1000) * 10000n
  const value = amount(amountUnits)
  return {
    kind: 'synthetic_journal',
    idempotency_key: syntheticId('load-ledger', i),
    source_invoice_key: syntheticId('load-invoice', i),
    branch: 'B' + String(((i - 1) % 30) + 1).padStart(2, '0'),
    currency: 'YER',
    lines: [
      { account: 'SYNTHETIC-CASH', debit: value, credit: '0.0000' },
      { account: 'SYNTHETIC-REVENUE', debit: '0.0000', credit: value },
    ],
  }
}
function integerFlag(args, flag, fallback) {
  const index = args.indexOf(flag)
  const value = index < 0 ? String(fallback) : args[index + 1]
  if (!/^\d+$/.test(value ?? '')) throw new Error(flag + ' expects a positive integer')
  const n = Number(value)
  if (!Number.isSafeInteger(n) || n < 1 || n > 100000) throw new Error(flag + ' must be between 1 and 100000')
  return n
}
export async function generateFile(out, invoices, operations) {
  const file = createWriteStream(resolve(out), { flags: 'wx' })
  let streamError
  file.once('error', e => { streamError = e })
  async function write(item) {
    if (streamError) throw streamError
    if (!file.write(JSON.stringify(item) + '\n')) await once(file, 'drain')
  }
  try {
    for (let i = 1; i <= invoices; i++) await write(invoiceFixture(i))
    for (let i = 1; i <= operations; i++) await write(journalFixture(i))
    file.end()
    await once(file, 'finish')
    return { invoices, accounting_operations: operations, total: invoices + operations, staging_only: true }
  } catch (error) {
    file.destroy()
    throw error
  }
}
async function main() {
  const args = process.argv.slice(2)
  const index = args.indexOf('--out')
  const out = index < 0 ? null : args[index + 1]
  if (!out || out.startsWith('-')) throw new Error('--out <unused local JSONL file> is required')
  const invoices = integerFlag(args, '--invoices', 100000)
  const ops = integerFlag(args, '--operations', 100000)
  const summary = await generateFile(out, invoices, ops)
  console.log(JSON.stringify(summary))
  console.log('Fixtures only: NOT an ERP invoice transaction, actual load result or offline-sales certificate.')
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
