import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, test } from 'node:test';
import { artifactDirectory, root, run } from '../common.js';
import { diagnose } from '../tooling-doctor.js';
import { IMAGE, scanPlan } from '../strix-scan.js';

const tempParent = realpathSync(tmpdir());
const fixture = mkdtempSync(join(tempParent, 'ympharma-tooling-'));
after(() => {
  // Remove only the generated fixture immediately below the temporary directory.
  assert.equal(dirname(realpathSync(fixture)), tempParent);
  rmSync(fixture, { recursive: true, force: true });
});
const base = join(fixture, 'repository with spaces');
mkdirSync(join(base, 'staging-scan'), { recursive: true });
const allowed = { allowedTargets: ['./staging-scan'] };
const enabled = { SECURITY_STRIX_DOCKER: '1', SCAN_TARGET: './staging-scan' };
const cleanEnv = { ...process.env, SECURITY_STRIX_DOCKER: '', CTX7_ALLOW: '', SKILLUI_ALLOW: '' };
const cli = (file, args = []) => spawnSync(process.execPath, [resolve(root, file), ...args], {
  cwd: fixture, env: cleanEnv, encoding: 'utf8', timeout: 10_000,
});

test('Strix accepts the checked-in object shape and space-containing local paths', () => {
  assert.deepEqual(scanPlan(enabled, allowed, base), { directory: realpathSync(join(base, 'staging-scan')), image: IMAGE });
  assert.deepEqual(JSON.parse(readFileSync(resolve(root, 'scripts/devtools/strix-allowlist.json'), 'utf8')), allowed);
});

test('Strix blocks absent opt-in, mutable images, URLs, traversal, globs and unapproved paths', () => {
  assert.throws(() => scanPlan({}, allowed, base), /opt in/);
  for (const STRIX_IMAGE of ['ghcr.io/usestrix/strix-sandbox:latest', IMAGE + '; whoami']) {
    assert.throws(() => scanPlan({ ...enabled, STRIX_IMAGE }, allowed, base), /overrides/);
  }
  for (const SCAN_TARGET of ['https://example.com', '../outside', '.', './staging-scan/**', 'C:\\outside']) {
    assert.throws(() => scanPlan({ ...enabled, SCAN_TARGET }, allowed, base));
  }
  assert.throws(() => scanPlan(enabled, ['./staging-scan'], base), /allowedTargets/);
  assert.throws(() => scanPlan(enabled, { allowedTargets: ['./staging-scan/**'] }, base), /globs/);
});

test('Strix rejects a junction/symlink escaping the checkout', () => {
  const outside = join(fixture, 'outside');
  mkdirSync(outside);
  symlinkSync(outside, join(base, 'linked-target'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => scanPlan({ ...enabled, SCAN_TARGET: './linked-target' }, { allowedTargets: ['./linked-target'] }, base), /inside/);
});

test('Artifact output rejects traversal and escaping junctions before creating files', () => {
  assert.throws(() => artifactDirectory('../outside/output', base), /inside artifacts/);
  assert.equal(artifactDirectory('artifacts/safe output', base), join(base, 'artifacts', 'safe output'));
  symlinkSync(join(fixture, 'outside'), join(base, 'artifacts', 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => artifactDirectory('artifacts/escape/new', base), /link leaves/);
  symlinkSync(join(base, 'staging-scan'), join(base, 'artifacts', 'source-link'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => artifactDirectory('artifacts/source-link/new', base), /link leaves/);
});

test('Doctor tolerates absent optional tools and reads the repository package from another cwd', () => {
  const probe = (command) => ({ status: ['docker', 'pwsh'].includes(command) ? 1 : 0 });
  const result = diagnose(probe);
  assert.equal(result.code, 0);
  assert.equal(result.checks.filter((check) => !check.ok).length, 2);
  assert.equal(result.checks.at(-1).ok, true);
  assert.equal(diagnose(() => ({ status: 1 })).code, 2);
  assert.equal(diagnose(probe, fixture).code, 2);
});

test('ESM command entrypoints block scans and network tools before launching children', () => {
  for (const name of ['strix-scan', 'ctx7-check', 'skillui-extract']) {
    const result = cli('scripts/devtools/' + name + '.js');
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /Blocked:/);
    assert.doesNotMatch(result.stderr, /require is not defined/);
  }
  for (const args of [[], ['ctx7'], ['skillui']]) {
    const file = args.length ? 'optional-help' : 'strix-help';
    assert.equal(cli('scripts/devtools/' + file + '.js', args).status, 0);
  }
});

test('Process arguments remain literal, nonzero exits propagate, missing executables fail', () => {
  const output = join(fixture, 'args.json');
  const sentinel = 'value with spaces; $(not-a-command) & echo';
  const result = run(process.execPath, ['--input-type=module', '-e', 'import {writeFileSync} from "node:fs"; writeFileSync(process.argv[1], JSON.stringify(process.argv.slice(2)))', output, sentinel], { stdio: 'pipe' });
  assert.equal(result, 0);
  assert.deepEqual(JSON.parse(readFileSync(output, 'utf8')), [sentinel]);
  assert.equal(run(process.execPath, ['-e', 'process.exit(7)'], { stdio: 'pipe' }), 7);
  assert.equal(run(join(fixture, 'missing-executable'), [], { stdio: 'pipe' }), 1);
});

test('Cloudflare validate rejects override arguments before resolving dependencies or building', () => {
  for (const args of [['--dry-run=false'], ['--dry-run', 'false'], ['--config', 'other.toml'], ['--env', 'production']]) {
    const result = cli('scripts/cloudflare-target.mjs', ['validate', ...args]);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /does not accept additional arguments/);
    assert.doesNotMatch(result.stdout, /building|deploying/i);
  }
});

test('Package entrypoints route through the guarded local scripts', () => {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['security:strix:docker'], 'node scripts/devtools/strix-scan.js');
  assert.equal(pkg.scripts['playwright:install'], 'node scripts/devtools/playwright-install.js');
  for (const key of ['ctx7:help', 'skillui:help', 'skillui:extract', 'ctx7:check']) assert.match(pkg.scripts[key], /^node scripts\/devtools\//);
});

test('Git excludes environment variants, generated output and dependencies while preserving templates', () => {
  const ignored = ['.env', '.env.production', '.env.local.backup', 'nested/.env.test', 'node_modules/pkg/index.js', '.wrangler/state/a', 'supabase/.temp/file', 'artifacts/report.json', 'staging-scan/source.js'];
  const templates = ['.env.example', '.env.production.example'];
  const result = spawnSync('git', ['check-ignore', '--no-index', '--stdin'], { cwd: root, input: [...ignored, ...templates].join('\n') + '\n', encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.trim().split(/\r?\n/).sort(), ignored.sort());
});
