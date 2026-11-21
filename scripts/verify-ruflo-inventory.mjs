#!/usr/bin/env node
/**
 * Passive Ruflo inventory integrity and heuristic audit.
 * No package installation, CLI invocation, network access, or execution of vendor code.
 * Designed to run in PR CI with read-only access and no secrets.
 */
import {readFile, realpath, lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, dirname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vendor = resolve(project, 'third_party/ruflo');
const PIN = '87f612cef121b50c2e31e2d3f88e46d88963a377';
const failures = [];
const warn = [];
const patterns = [
  ['pipe-to-shell', /(?:curl|wget)[^\n]{0,180}\|\s*(?:sh|bash|pwsh|powershell)\b/gi],
  ['shell-or-code-execution', /\b(?:eval\s*\(|exec\s*\(|subprocess\.run|Invoke-Expression|child_process)\b/gi],
  ['credential-or-sensitive-path', /(?:\.ssh\/|\.aws\/|\.env\b|API_KEY|SECRET_KEY|PRIVATE_KEY)\b/gi],
  ['unbounded-agent-or-background-work', /(?:run_in_background|auto.?merge|cron|--dangerously-skip-permissions)/gi],
  ['network-exfiltration-candidate', /(?:curl|wget|fetch|requests\.post)[^\n]{0,130}(?:https?:\/\/|webhook)/gi],
];
const indicators = Object.fromEntries(patterns.map(([name]) => [name, {files: 0, matches: 0, examples: []}]));
const error = (message) => {failures.push(message);};
function safePath(p) {
  return typeof p === 'string' && p.length > 0 && !p.startsWith('/') &&
    !p.includes('\\') && !/[\u0000-\u001f\u007f]/.test(p) &&
    p.split('/').every(s => s !== '' && s !== '.' && s !== '..');
}
function assertFileRecords(records, label) {
  if (!Array.isArray(records)) throw Error(label + ' must be an array');
  const known = new Set();
  for (const r of records) {
    if (!safePath(r.path) || known.has(r.path)) error(label + ': invalid or duplicated path ' + String(r.path));
    known.add(r.path);
  }
}
async function parse(path) {
  return JSON.parse(await readFile(resolve(project, path), 'utf8'));
}
const [catalog, manifest] = await Promise.all([
  parse('.agent-toolkit/ruflo/catalog.json'),
  parse('third_party/ruflo/MANIFEST.json'),
]);
if (catalog.revision !== PIN || manifest.sourceCommit !== PIN) error('Pinned revision mismatch');
if (catalog.entry_policy !== 'inventory-only;not-trusted-or-enabled') error('Source inventory safety flag changed');
if (catalog.source_count !== 403 || catalog.skill_files?.length !== 403) error('Expected 403 upstream source skill entries');
if (manifest.skills !== 336 || manifest.files?.length !== 348) error('Unexpected 336-skill snapshot/348-file count');
assertFileRecords(catalog.skill_files, 'source-catalog');
assertFileRecords(manifest.files, 'vendor-manifest');
let verified = 0, scannedSkills = 0, verifiedBytes = 0;
const catalogPaths = new Set(catalog.skill_files.map(f => f.path));
for (const f of catalog.skill_files) {
  if (!f.path.endsWith('SKILL.md') || !/^[a-f0-9]{40}$/.test(f.git_blob_sha || ''))
    error('Invalid upstream git-blob metadata: ' + f.path);
}
for (const f of manifest.files) {
  if (!safePath(f.path)) continue;
  const absolute = resolve(vendor, f.path);
  if (!absolute.startsWith(vendor + sep)) {error('File escapes vendor: ' + f.path); continue;}
  let content;
  try {
    const st = await lstat(absolute);
    const real = await realpath(absolute);
    if (!st.isFile() || !real.startsWith(vendor + sep)) {error('Non-regular or escaped source: ' + f.path); continue;}
    content = await readFile(absolute);
  } catch (e) {error('Missing or unreadable: ' + f.path + ' (' + e.code + ')'); continue;}
  if (content.length !== f.bytes || createHash('sha256').update(content).digest('hex') !== f.sha256) {
    error('Byte count or SHA-256 mismatch: ' + f.path); continue;
  }
  verified++;verifiedBytes += content.length;
  if (!f.path.endsWith('/SKILL.md')) continue;
  scannedSkills++;
  if (!catalogPaths.has(f.path)) error('Snapshot skill absent in complete upstream inventory: ' + f.path);
  const source = content.toString('utf8');
  if (!source.startsWith('---\n')) error('Missing frontmatter: ' + f.path);
  for (const [name, re] of patterns) {
    re.lastIndex = 0;
    const count = [...source.matchAll(re)].length;
    if (count) {
      const record = indicators[name]; record.files++; record.matches += count;
      if (record.examples.length < 12) record.examples.push(f.path);
    }
  }
}
if (scannedSkills !== 336) error('Expected 336 verified archived SKILL.md files');
const grouped = (catalog.official_featured || []).flatMap(x => x.skills || []);
if (catalog.official_featured?.length !== 34 || grouped.length !== 134 ||
    new Set(grouped).size !== 134) error('Expected 134 advertised unique skills in 34 groups');
const deepIndex = process.argv.indexOf('--deep-path');
let sourceContentChecked = 0, sourceContentBytes = 0, deepIndicators = null;
if (deepIndex >= 0) {
  const rawPath = process.argv[deepIndex + 1];
  if (!rawPath || rawPath.startsWith('--')) throw Error('Missing --deep-path argument');
  const deepRoot = await realpath(resolve(rawPath));
  deepIndicators = Object.fromEntries(patterns.map(([name]) => [name, {files: 0, matches: 0, examples: []}]));
  for (const f of catalog.skill_files) {
    if (!safePath(f.path)) continue;
    const absolute = resolve(deepRoot, f.path);
    if (!absolute.startsWith(deepRoot + sep)) {error('Escaped upstream path: ' + f.path); continue;}
    let content;
    try {
      const st = await lstat(absolute);
      const real = await realpath(absolute);
      if (!st.isFile() || !real.startsWith(deepRoot + sep)) {error('Unsafe upstream file: ' + f.path); continue;}
      content = await readFile(absolute);
    } catch (e) {error('Missing upstream source: ' + f.path + ' (' + e.code + ')'); continue;}
    if (content.length > 256 * 1024) {error('Oversized upstream file: ' + f.path); continue;}
    const sha = createHash('sha1').update('blob ' + content.length + '\0').update(content).digest('hex');
    if (sha !== f.git_blob_sha) {error('Upstream source SHA-1 mismatch: ' + f.path); continue;}
    sourceContentChecked++;sourceContentBytes += content.length;
    const source = content.toString('utf8');
    for (const [name, re] of patterns) {
      re.lastIndex = 0;
      const count = [...source.matchAll(re)].length;
      if (count) {
        const record = deepIndicators[name];record.files++;record.matches += count;
        if (record.examples.length < 12) record.examples.push(f.path);
      }
    }
  }
  if (sourceContentChecked !== 403) error('Expected to hash-verify and scan 403 upstream SKILL.md files');
}

const result = {
  upstreamCommit: PIN,
  sourceSkillPaths: catalog.skill_files.length,
  publishedSkills: grouped.length,
  archivedVerifiedFiles: verified,
  archivedSkillFilesScanned: scannedSkills,
  archivedVerifiedBytes: verifiedBytes,
  fullSourceSkillsVerifiedAndScanned: sourceContentChecked,
  fullSourceBytes: sourceContentBytes,
  fullSourceHeuristicIndicators: deepIndicators,
  heuristicIndicators: indicators,
  issues: failures,
  note: 'Static heuristics are leads, not confirmed vulnerabilities. The 336 archived files are always scanned; all 403 upstream files are additionally source-hash verified and scanned only when --deep-path is provided. No runtime or production tests were run.',
};
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
