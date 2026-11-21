#!/usr/bin/env node
// Provenance-verified Ruflo skill archiver. This program NEVER runs upstream skill commands.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(await readFile(resolve(root, '.agent-toolkit/ruflo/catalog.json'), 'utf8'));
const entries = catalog.skill_files;
const command = process.argv[2] || 'list';
if (!Array.isArray(entries) || entries.length !== catalog.source_count ||
    !/^[a-f0-9]{40}$/.test(catalog.revision)) throw new Error('Invalid catalog');
if (new Set(entries.map(x => x.path)).size !== entries.length) throw new Error('Duplicate source paths');
const safePath = p => typeof p === 'string' && !p.startsWith('/') && !p.includes('\\') &&
  p.split('/').every(s => s.length > 0 && s !== '.' && s !== '..');
for (const entry of entries) {
  if (!safePath(entry.path) || !entry.path.endsWith('SKILL.md') ||
      !/^[a-f0-9]{40}$/.test(entry.git_blob_sha)) throw new Error('Unsafe catalog entry');
}
const hash = b => createHash('sha1').update('blob ' + b.length + '\0').update(b).digest('hex');
const base = resolve(root, '.agent-toolkit/ruflo/vendor');
const target = e => {
  const p = resolve(base, ...e.path.split('/'));
  if (!p.startsWith(base + sep)) throw new Error('Path escape');
  return p;
};
async function check(entry) {
  const bytes = await readFile(target(entry));
  if (hash(bytes) !== entry.git_blob_sha) throw new Error('Source hash mismatch: ' + entry.path);
  return bytes;
}
async function download(entry) {
  try { await check(entry); return 'already-verified'; }
  catch (err) { if (err.code !== 'ENOENT') throw err; }
  const uri = 'https://raw.githubusercontent.com/ruvnet/ruflo/' + catalog.revision + '/' +
    entry.path.split('/').map(encodeURIComponent).join('/');
  const res = await fetch(uri, { redirect: 'error' });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + entry.path);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > 300000 || hash(bytes) !== entry.git_blob_sha) {
    throw new Error('Unverified upstream content: ' + entry.path);
  }
  const dst = target(entry);
  await mkdir(dirname(dst), { recursive: true });
  await writeFile(dst, bytes, { flag: 'wx' });
  return 'archived';
}
if (command === 'list') {
  const byScope = {};
  for (const e of entries) byScope[e.scope] = (byScope[e.scope] || 0) + 1;
  console.log(JSON.stringify({source:catalog.source,revision:catalog.revision,
    total:entries.length,byScope,paths:process.argv.includes('--full')?entries.map(e=>e.path):undefined},null,2));
} else if (command === 'stage-all') {
  let good = 0; const errors = [];
  // Four workers, no recursive execution, no auto-retry, no new dependencies.
  await Promise.all(Array.from({length:4},async(_,worker)=>{
    for(let n=worker;n<entries.length;n+=4){
      try { await download(entries[n]); good++; }
      catch (err) { errors.push({path:entries[n].path,error:String(err)}); }
    }
  }));
  const report = {source_revision:catalog.revision,archived_or_verified:good,failed:errors};
  await writeFile(resolve(root,'.agent-toolkit/ruflo/STAGE-RESULT.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({archived_or_verified:good,failed:errors.length},null,2));
  if (errors.length) process.exitCode = 1;
} else if (command === 'verify') {
  let good=0,missing=0;
  for(const entry of entries){
    try {await check(entry);good++}
    catch(err){if(err.code==='ENOENT')missing++;else throw err}
  }
  console.log(JSON.stringify({verified:good,missing,total:entries.length},null,2));
  if (missing) process.exitCode = 2;
} else if (command === 'audit') {
  const rules = [
    ['pipe-to-shell',/(curl|wget)[^\n]{0,160}\|\s*(sh|bash|powershell|pwsh)/gi],
    ['dangerous-shell',/\b(rm\s+-rf|Remove-Item\s+[^\n]*-Recurse|format\s+[a-z]:)/gi],
    ['credential-touch',/(?:\.ssh\/|\.aws\/credentials|\.env\b|process\.env|API_KEY|SECRET_KEY)/gi],
    ['dynamic-execution',/(eval\(|exec\(|subprocess|Invoke-Expression|child_process)/gi],
    ['autonomous-operations',/(run_in_background|auto.?merge|cron|write.?access)/gi],
  ];
  const findings=[];let checked=0,missing=0;
  for(const entry of entries){
    let text;
    try{text=(await check(entry)).toString('utf8')}
    catch(err){if(err.code==='ENOENT'){missing++;continue}throw err}
    checked++;
    for(const [rule,pattern] of rules){
      const n=[...text.matchAll(pattern)].length;
      if(n)findings.push({path:entry.path,rule,matches:n});
    }
  }
  const report={checked,missing,findings,limitations:'Heuristics only; manually inspect every finding and scripts; run SkillSpector before activation.'};
  await writeFile(resolve(root,'.agent-toolkit/ruflo/AUDIT-RESULT.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({checked,missing,findings:findings.length},null,2));
  if(missing)process.exitCode=2;
} else {
  console.error('Usage: node scripts/ruflo-skills.mjs [list [--full] | stage-all | verify | audit]');
  process.exitCode = 2;
}
