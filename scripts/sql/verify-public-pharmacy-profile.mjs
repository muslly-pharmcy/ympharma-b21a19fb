// In-memory PostgreSQL (PGlite). No connection URL or production data accepted.
// Install @electric-sql/pglite in a separate tooling directory, then set PG_TEST_TOOLING_ROOT.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const require = createRequire(resolve(process.env.PG_TEST_TOOLING_ROOT || '.', 'package.json'));
const { PGlite } = await import(pathToFileURL(require.resolve('@electric-sql/pglite')).href);
const db = new PGlite();
const root = new URL('../../', import.meta.url);
const original = await readFile(new URL('supabase/migrations/20260714195728_6c09917b-6d53-4879-9263-72d70963809a.sql', root), 'utf8');
const patch = await readFile(new URL('supabase/migrations/20261116060000_minimize_public_pharmacy_profile.sql', root), 'utf8');
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE TABLE public.organizations(id uuid PRIMARY KEY);
    CREATE TABLE public.catalog_products(id uuid PRIMARY KEY);
    CREATE TYPE public.pn_verification_status AS ENUM ('pending','verified','rejected');
    CREATE TYPE public.pn_availability AS ENUM ('in_stock','low','out');`);
  for (const name of ['pn_pharmacies', 'pn_pharmacy_hours', 'pn_pharmacy_stock']) {
    const table = original.match(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${name} \\([\\s\\S]*?\\n\\);`));
    assert.ok(table, name);
    await db.exec(table[0]);
    await db.exec(`ALTER TABLE public.${name} ENABLE ROW LEVEL SECURITY;`);
  }
  const priorFunction = original.match(/CREATE OR REPLACE FUNCTION public\.pn_get_pharmacy_public\(_slug text\)[\s\S]*?\$\$;/)[0];
  await db.exec(priorFunction);
  await db.exec(`REVOKE ALL ON FUNCTION public.pn_get_pharmacy_public(text) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.pn_get_pharmacy_public(text) TO authenticated;
    INSERT INTO public.pn_pharmacies (slug,name_ar,is_public,verification_status,metadata)
    VALUES ('visible','Synthetic public',true,'verified','{"internal":"hidden"}'),
    ('private','Synthetic private',false,'verified','{}'),
    ('pending','Synthetic pending',true,'pending','{}');
    ALTER TABLE public.pn_pharmacies ADD COLUMN future_internal_note text DEFAULT 'must never leak';
    INSERT INTO public.pn_pharmacy_hours(pharmacy_id,weekday,open_time,close_time)
    SELECT id,1,'08:00','20:00' FROM public.pn_pharmacies WHERE slug='visible';`);
  const acl = async () => (await db.query(`SELECT has_function_privilege('anon','public.pn_get_pharmacy_public(text)','EXECUTE') AS anon,
    has_function_privilege('authenticated','public.pn_get_pharmacy_public(text)','EXECUTE') AS authenticated`)).rows;
  const before = await acl();
  assert.deepEqual(before, [{ anon: false, authenticated: true }]);
  await db.exec(patch);
  assert.deepEqual(await acl(), before);
  await db.exec('SET ROLE anon');
  await assert.rejects(db.query("SELECT public.pn_get_pharmacy_public('visible')"), { code: '42501' });
  await db.exec('RESET ROLE; SET ROLE authenticated');
  const profile = async slug => (await db.query('SELECT public.pn_get_pharmacy_public($1) AS data', [slug])).rows[0].data;
  const result = await profile('visible');
  assert.equal(result.pharmacy.name_ar, 'Synthetic public');
  assert.deepEqual(Object.keys(result.pharmacy).sort(), [
    'id','slug','name_ar','name_en','phone','whatsapp','email','city','district',
    'address','lat','lng','logo_url','cover_url','bio_ar','is_public','is_24_7','verification_status'
  ].sort());
  for (const field of ['metadata','organization_id','created_by','verified_by','verified_at','created_at','updated_at','future_internal_note']) {
    assert.equal(field in result.pharmacy, false, field);
  }
  assert.deepEqual(Object.keys(result.hours[0]).sort(), ['close_time','is_closed','open_time','weekday']);
  assert.equal(result.product_count, 0);
  for (const slug of ['private','pending','missing', null, "visible' OR true --"]) assert.equal(await profile(slug), null);
  await assert.rejects(db.query('SELECT * FROM public.pn_pharmacies'), { code: '42501' });
  await db.exec('RESET ROLE');
  // Applying twice preserves behavior and ACL as well.
  await db.exec(patch);
  assert.deepEqual(await acl(), before);
  // Production currently permits anon. This patch must minimize that response too
  // without silently changing the deployment's access contract.
  await db.exec('GRANT EXECUTE ON FUNCTION public.pn_get_pharmacy_public(text) TO anon');
  await db.exec(patch);
  assert.deepEqual(await acl(), [{ anon: true, authenticated: true }]);
  await db.exec('SET ROLE anon');
  assert.deepEqual(await profile('visible'), result);
  assert.equal(await profile('private'), null);
  await db.exec('RESET ROLE');
  console.log(JSON.stringify({status:'PASS', engine:'PGlite in-memory PostgreSQL',
    checks:['explicit fields','future-column non-disclosure','private and pending hidden','parameter isolation','hours allowlist','ACL preserved','anon denied','direct table access denied','repeat application'],
    limitations:'Synthetic RPC fixture only; not full Supabase RLS, production drift, backup recovery, or external consumer acceptance'}, null, 2));
} finally { await db.close(); }
