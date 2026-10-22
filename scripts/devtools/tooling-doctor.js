#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isMain, root } from './common.js';

export function diagnose(probe = spawnSync, base = root) {
  const tools = [
    { name: 'Node', command: process.execPath, required: true },
    { name: 'Bun', command: 'bun', required: true },
    { name: 'Git', command: 'git', required: true },
    { name: 'Docker CLI (optional; engine not checked)', command: 'docker', required: false },
    { name: 'PowerShell 7 (optional)', command: 'pwsh', required: false },
  ];
  const checks = tools.map((tool) => {
    const result = probe(tool.command, ['--version'], { cwd: base, shell: false, encoding: 'utf8', timeout: 10_000 });
    return { name: tool.name, required: tool.required, ok: result.status === 0 && !result.error && !result.signal };
  });
  try {
    const pkg = JSON.parse(readFileSync(resolve(base, 'package.json'), 'utf8'));
    checks.push({ name: '@playwright/test declared', required: true, ok: Boolean(pkg.devDependencies?.['@playwright/test']) });
  } catch {
    checks.push({ name: 'Repository package.json readable', required: true, ok: false });
  }
  return { checks, code: checks.some((check) => check.required && !check.ok) ? 2 : 0 };
}

if (isMain(import.meta.url)) {
  const result = diagnose();
  for (const check of result.checks) console.log((check.ok ? 'OK' : check.required ? 'MISSING' : 'OPTIONAL') + ': ' + check.name);
  process.exitCode = result.code;
}
