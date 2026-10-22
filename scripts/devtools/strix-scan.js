#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync, realpathSync, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const IMAGE = 'ghcr.io/usestrix/strix-sandbox:1.3.0';
const root = realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
const allowFile = new URL('./strix-allowlist.json', import.meta.url);
function block(message) {
  console.error(`Blocked: ${message}`);
  process.exit(2);
}
if (process.argv.includes('--help')) {
  console.log('Requires SECURITY_STRIX_DOCKER=1 and an exact local SCAN_TARGET in strix-allowlist.json. Use --dry-run to validate without Docker.');
  process.exit(0);
}
if (process.env.SECURITY_STRIX_DOCKER !== '1') block('set SECURITY_STRIX_DOCKER=1.');
const target = process.env.SCAN_TARGET;
if (!target) block('set SCAN_TARGET to an allowed local directory.');
let allowedTargets;
try {
  ({ allowedTargets } = JSON.parse(readFileSync(allowFile, 'utf8')));
} catch {
  block('allowlist is missing or invalid JSON.');
}
if (!Array.isArray(allowedTargets) || !allowedTargets.every(value => typeof value === 'string')) {
  block('allowlist must contain an allowedTargets string array.');
}
if (!allowedTargets.includes(target) || target.includes('*')) block('SCAN_TARGET must match an exact allowlist entry; wildcards are not supported.');
let resolved;
try {
  resolved = realpathSync(path.resolve(root, target));
  if (!statSync(resolved).isDirectory()) block('SCAN_TARGET must be a directory.');
} catch {
  block('SCAN_TARGET directory does not exist.');
}
const relative = path.relative(root, resolved);
if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
  block('SCAN_TARGET must stay inside the repository and cannot be its root.');
}
if (process.env.STRIX_IMAGE && process.env.STRIX_IMAGE !== IMAGE) block('STRIX_IMAGE override does not match the pinned image.');
const args = ['run', '--rm', '-v', `${root}:/work`, '-w', '/work', IMAGE, 'strix', '--target', `/work/${relative.split(path.sep).join('/')}`, '--reporter', 'json', '--output', '/work/artifacts/strix-report.json'];
if (process.argv.includes('--dry-run')) {
  console.log(JSON.stringify({ command: 'docker', args }));
  process.exit(0);
}
mkdirSync(path.join(root, 'artifacts'), { recursive: true });
const child = spawn('docker', args, { stdio: 'inherit', shell: false });
child.on('error', error => {
  console.error(`Cannot start Docker: ${error.message}`);
  process.exitCode = 1;
});
child.on('close', (code, signal) => {
  process.exitCode = code ?? 1;
  if (code === 0) console.log('Strix completed. Sanitize artifacts/strix-report.json before sharing.');
  else console.error(`Strix failed: ${signal || code}`);
});
