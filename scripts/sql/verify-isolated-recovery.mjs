// Creates its own loopback-only synthetic cluster. Never accepts a database URL.
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';

const require = createRequire(resolve(process.env.PG_TEST_TOOLING_ROOT || '.', 'package.json'));
const { default: EmbeddedPostgres } = await import(pathToFileURL(require.resolve('embedded-postgres')).href);
const bin = process.env.PG_TEST_BIN;
if (!bin) throw new Error('PG_TEST_BIN must point to local PostgreSQL binaries');
const run = promisify(execFile);
const root = fileURLToPath(new URL('../../', import.meta.url));
const directory = await mkdtemp(join(tmpdir(), 'ympharma-recovery-'));
const port = Number(process.env.PG_TEST_PORT || 55447);
const password = crypto.randomUUID();
const instance = new EmbeddedPostgres({ databaseDir: join(directory, 'data'), user: 'postgres', password,
  port, persistent: true, postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
const env = { ...process.env, PGHOST: '127.0.0.1', PGPORT: String(port), PGUSER: 'postgres', PGPASSWORD: password };
const command = async (name, args) => run(join(bin, name + (process.platform === 'win32' ? '.exe' : '')), args, { env });
async function sqlFile(database, path) {
  const c = await client(database);
  try {
    const sql = (await readFile(join(root, path), 'utf8')).replace(/^\\set ON_ERROR_STOP on\r?$/gm, '');
    await c.query(sql);
  } finally { await c.end(); clients.delete(c); }
}
const clients = new Set();
async function client(database) { const c = instance.getPgClient(database, '127.0.0.1'); clients.add(c); await c.connect(); return c; }
async function snapshot(c) {
  const result = {};
  for (const table of ['synthetic_members', 'wh_warehouses', 'inv_stock_batches', 'inv_stock_movements', 'synthetic_events']) {
    result[table] = (await c.query(`SELECT coalesce(jsonb_agg(x ORDER BY x::text), '[]'::jsonb) AS data FROM (SELECT to_jsonb(t) x FROM public.${table} t) q`)).rows[0].data;
  }
  result.acl = (await c.query("SELECT has_function_privilege('anon','public.inv_adjust_stock(uuid,numeric,text)','EXECUTE') anon, has_function_privilege('authenticated','public.inv_adjust_stock(uuid,numeric,text)','EXECUTE') authenticated")).rows;
  return result;
}
try {
  await instance.initialise(); await instance.start();
  await instance.createDatabase('synthetic_source'); await instance.createDatabase('synthetic_restored');
  await sqlFile('synthetic_source', 'scripts/sql/legacy-stock-rpc-ci-fixtures.sql');
  await sqlFile('synthetic_source', 'supabase/migrations/20261116021000_guard_legacy_inv_adjust_stock.sql');
  await sqlFile('synthetic_source', 'scripts/sql/legacy-stock-rpc-acceptance.sql');
  const attempts = await Promise.all(Array.from({ length: 20 }, async () => {
    const c = await client('synthetic_source');
    await c.query("SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false)");
    try { await c.query("SELECT public.inv_adjust_stock('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',-1,'concurrency recovery test')"); return 'success'; }
    catch (e) { if (e.code !== '23514') throw e; return 'reserved'; }
    finally { await c.end(); clients.delete(c); }
  }));
  assert.equal(attempts.filter(x => x === 'success').length, 1);
  const source = await client('synthetic_source');
  const before = await snapshot(source);
  const target = before.inv_stock_batches.find(x => x.id === 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
  assert.equal(Number(target.qty_on_hand), 8);
  assert.equal(Number(target.qty_reserved), 8);
  assert.equal(before.inv_stock_movements.filter(x => x.batch_id === target.id).length, 2);
  console.log('PASS: SQL acceptance and 20 competing decrements; exactly one succeeded, stock=reserved=8, movements=2.');
  const dump = join(directory, 'synthetic.dump');
  await command('pg_dump', ['-Fc', '-d', 'synthetic_source', '-f', dump]);
  await command('pg_restore', ['--exit-on-error', '-d', 'synthetic_restored', dump]);
  const restored = await client('synthetic_restored');
  assert.deepEqual(await snapshot(restored), before);
  await restored.query("SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false)");
  await assert.rejects(restored.query("SELECT public.inv_adjust_stock('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',-1,'restored invariant')"), { code: '23514' });
  await restored.query('RESET ROLE');
  assert.deepEqual(await snapshot(restored), before);
  const report = { status: 'PASS', postgres: (await source.query('SELECT version()')).rows[0].version,
    concurrentAttempts: 20, successfulDecrements: 1, restoredSnapshotEqual: true, restoredReservationGuard: true,
    scope: 'Synthetic legacy inventory RPC only; not accounting, device quotas, full-schema restore, or production acceptance' };
  await writeFile(join(directory, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, evidenceDirectory: directory }, null, 2));
} finally {
  await Promise.allSettled([...clients].map(c => c.end()));
  await instance.stop();
}
