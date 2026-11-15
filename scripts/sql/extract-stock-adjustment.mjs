// Emit the real historical stock mutation for disposable integration tests.
import { readFileSync } from 'node:fs'
const source = readFileSync('supabase/migrations/20260720083643_428207f9-fd9a-4783-8128-06cb0c0cd0f4.sql', 'utf8')
const start = source.indexOf('CREATE OR REPLACE FUNCTION public.inv_adjust_stock(')
const end = source.indexOf('-- ---------- inv_reserve_fefo ----------', start)
if (start < 0 || end < 0) throw new Error('Historical adjustment function not found')
process.stdout.write(source.slice(start, end))
