#!/usr/bin/env node
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { artifactDirectory, isMain, root, run, within } from './common.js';

export const IMAGE = 'ghcr.io/usestrix/strix-sandbox:1.3.0';

export function scanPlan(env, config, base = root) {
  if (env.SECURITY_STRIX_DOCKER !== '1') throw new Error('Set SECURITY_STRIX_DOCKER=1 to opt in.');
  if (env.STRIX_IMAGE && env.STRIX_IMAGE !== IMAGE) throw new Error('Image overrides are disabled; review the pinned image in source.');
  const target = env.SCAN_TARGET;
  if (!target || isAbsolute(target) || target.includes(':') || target.includes('..') || /[*?\r\n]/.test(target)) {
    throw new Error('SCAN_TARGET must be an approved relative local directory.');
  }
  if (!Array.isArray(config?.allowedTargets) || config.allowedTargets.length === 0 || config.allowedTargets.some((value) => typeof value !== 'string' || /[*?]/.test(value))) {
    throw new Error('Allowlist must contain allowedTargets with exact directory names; globs are not supported.');
  }
  if (!config.allowedTargets.includes(target)) throw new Error('SCAN_TARGET is not in the allowlist.');
  const directory = realpathSync(resolve(base, target));
  if (directory === realpathSync(base) || !within(realpathSync(base), directory) || !statSync(directory).isDirectory()) {
    throw new Error('The scan directory must stay inside the repository.');
  }
  if (directory.includes(',')) throw new Error('Docker mount paths cannot contain commas.');
  return { directory, image: IMAGE };
}

if (isMain(import.meta.url)) {
  try {
    const config = JSON.parse(readFileSync(new URL('./strix-allowlist.json', import.meta.url), 'utf8'));
    const plan = scanPlan(process.env, config);
    const output = artifactDirectory('artifacts/strix');
    if (output.includes(',')) throw new Error('Docker mount paths cannot contain commas.');
    process.exitCode = run('docker', [
      'run', '--rm', '--mount', 'type=bind,source=' + plan.directory + ',target=/work/target,readonly',
      '--mount', 'type=bind,source=' + output + ',target=/reports', '-w', '/work/target',
      plan.image, 'strix', '--target', '/work/target', '--reporter', 'json', '--output', '/reports/strix-report.json',
    ]);
  } catch (error) {
    console.error('Blocked: ' + error.message);
    process.exitCode = 2;
  }
}
