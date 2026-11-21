#!/usr/bin/env node
/**
 * Passive Ruflo skill vendor sync for YmPharma. No sourced code is executed.
 * Requires Node >=20 and git with partial-clone support. Default mode: --dry-run.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SHA = '87f612cef121b50c2e31e2d3f88e46d88963a377';
const URL = 'https://github.com/ruvnet/ruflo.git';
const root = process.cwd();
const vendor = path.resolve(root, 'third_party/ruflo');
const mode = process.argv[2] || '--dry-run';
const sourcePattern = /^(?:\.agents\/skills\/|\.claude\/skills\/|plugins\/[^/]+\/skills\/)/;
const MAX_FILES = 5000, MAX_FILE_BYTES = 8 * 1024 * 1024, MAX_TOTAL_BYTES = 80 * 1024 * 1024;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const output = x => process.stdout.write(x + '\n');

function git(...args) {
  const r = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  if (r.status !== 0) throw new Error('git ' + args.slice(0, 3).join(' ') + ': ' + (r.stderr || r.stdout || 'failed').slice(0, 1000));
  return (r.stdout || '').trim();
}
function assertInside(base, rel) {
  const p = path.resolve(base, rel);
  if (p === base || !p.startsWith(base + path.sep)) throw new Error('Unsafe relative path: ' + rel);
  return p;
}
function checkRepo() {
  if (!fs.existsSync(path.join(root, 'package.json')) || !fs.existsSync(path.join(root, 'AGENTS.md')))
    throw new Error('Run from the YmPharma repository root (package.json and AGENTS.md required).');
}
function verify() {
  const manifestPath = path.join(vendor, 'MANIFEST.json');
  if (!fs.existsSync(manifestPath)) throw new Error('No installed snapshot at third_party/ruflo');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.sourceCommit !== SHA) throw new Error('Unexpected source revision');
  let mismatches = 0;
  for (const f of manifest.files) {
    const p = assertInside(vendor, f.path);
    if (!fs.existsSync(p) || !fs.statSync(p).isFile()) { mismatches++; continue; }
    const data = fs.readFileSync(p);
    if (data.length !== f.bytes || sha256(data) !== f.sha256) mismatches++;
  }
  output(JSON.stringify({ sourceCommit: SHA, skills: manifest.skills, files: manifest.files.length, mismatches }, null, 2));
  if (mismatches) process.exitCode = 1;
}
if (!['--dry-run', '--install', '--verify'].includes(mode))
  throw new Error('Usage: node scripts/sync-ruflo-skills.mjs [--dry-run|--install|--verify]');
checkRepo();
if (mode === '--verify') verify();
else {
  const tempBase = process.env.RUFLO_TMP || os.tmpdir();
  if (!fs.existsSync(tempBase)) throw new Error('RUFLO_TMP directory does not exist');
  const tmp = fs.mkdtempSync(path.join(tempBase, 'ruflo-src-'));
  let stage = null;
  try {
    const source = path.join(tmp, 'source');
    git('clone', '--quiet', '--depth', '1', '--filter=blob:none', '--sparse', '--no-checkout', URL, source);
    git('-C', source, 'fetch', '--quiet', '--depth', '1', 'origin', SHA);
    const files = git('-C', source, 'ls-tree', '-r', '--name-only', SHA).split(/\r?\n/).filter(Boolean);
    const roots = files.filter(p => sourcePattern.test(p) && p.endsWith('/SKILL.md')).map(p => p.slice(0, -'SKILL.md'.length));
    const rootSet = new Set(roots);
    if (!rootSet.size || rootSet.size > 1000) throw new Error('Implausible upstream skill count');
    const wanted = files.filter(p => sourcePattern.test(p) && roots.some(r => p.startsWith(r)));
    if (wanted.length > MAX_FILES) throw new Error('Too many skill-related files');
    const pluginDirs = new Set(wanted.filter(p => p.startsWith('plugins/')).map(p => p.split('/').slice(0, 3).join('/')));
    git('-C', source, 'sparse-checkout', 'set', '--cone', '.agents/skills', '.claude/skills', ...pluginDirs);
    git('-C', source, 'checkout', '--quiet', '--detach', SHA);
    if (git('-C', source, 'rev-parse', 'HEAD') !== SHA) throw new Error('Commit mismatch');
    output(JSON.stringify({ mode, sourceCommit: SHA, skillRoots: rootSet.size,
      fromAgents: roots.filter(x => x.startsWith('.agents/')).length,
      fromClaude: roots.filter(x => x.startsWith('.claude/')).length,
      fromPlugins: roots.filter(x => x.startsWith('plugins/')).length,
      sourceFiles: wanted.length }, null, 2));
    if (mode === '--install') {
      if (fs.existsSync(vendor)) throw new Error('Refusing to overwrite existing third_party/ruflo');
      const parent = path.dirname(vendor);
      fs.mkdirSync(parent, { recursive: true });
      stage = fs.mkdtempSync(path.join(parent, 'ruflo-staged-'));
      const entries = [];
      let total = 0;
      for (const rel of wanted) {
        const src = assertInside(source, rel);
        const stat = fs.lstatSync(src);
        if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Unexpected nonregular source file: ' + rel);
        if (stat.size > MAX_FILE_BYTES || total + stat.size > MAX_TOTAL_BYTES)
          throw new Error('Snapshot exceeds file/total size limits');
        const data = fs.readFileSync(src);
        const dst = assertInside(stage, rel);
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.writeFileSync(dst, data, { flag: 'wx', mode: 0o644 });
        entries.push({ path: rel, bytes: data.length, sha256: sha256(data) });
        total += data.length;
      }
      const license = fs.readFileSync(path.join(source, 'LICENSE'));
      fs.writeFileSync(path.join(stage, 'UPSTREAM_LICENSE.txt'), license, { flag: 'wx' });
      entries.push({ path: 'UPSTREAM_LICENSE.txt', bytes: license.length, sha256: sha256(license) });
      fs.writeFileSync(path.join(stage, 'README.md'),
        '# Archived Ruflo skills\n\nUpstream: ' + URL + '\nCommit: ' + SHA +
        '\nLicense: MIT; see UPSTREAM_LICENSE.txt.\n\nThese are **untrusted, passive third-party references**. Do not execute scripts or automatically load these folders into an agent without reviewing each skill and its dependencies. Existing YmPharma AGENTS.md and pharmacy-specific skills remain authoritative.\n');
      const readme = fs.readFileSync(path.join(stage, 'README.md'));
      entries.push({ path: 'README.md', bytes: readme.length, sha256: sha256(readme) });
      fs.writeFileSync(path.join(stage, 'MANIFEST.json'), JSON.stringify({
        format: 1, source: URL, sourceCommit: SHA, skills: rootSet.size, bytes: total,
        files: entries, installedAt: new Date().toISOString()
      }, null, 2) + '\n');
      fs.renameSync(stage, vendor);
      stage = null;
      output('Imported passive vendor files to third_party/ruflo. Run --verify, review diff and test before activating.');
    }
  } finally {
    if (stage && fs.existsSync(stage)) fs.rmSync(stage, { recursive: true, force: true });
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
