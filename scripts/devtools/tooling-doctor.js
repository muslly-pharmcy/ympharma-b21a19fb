#!/usr/bin/env node
// tooling-doctor.js
// Cross-platform diagnostics for developer tools required by the repository.
// Exits with non-zero code if critical tooling is missing.
const { spawnSync } = require('child_process');
const fs = require('fs');
function check(cmd, args = ['--version'], name) {
  try {
    const res = spawnSync(cmd, args, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    if (res.status === 0) {
      console.log(`OK  : ${name} -> ${res.stdout.toString().trim().split('\n')[0]}`);
      return true;
    }
    console.warn(`MISS: ${name} -> ${res.stderr.toString().trim().split('\n')[0] || 'not found'}`);
    return false;
  } catch (e) {
    console.warn(`ERR : ${name} -> ${String(e)}`);
    return false;
  }
}
console.log('Running tooling doctor...');
const checks = [];
checks.push(check('node', ['-v'], 'Node (node)'));
checks.push(check('npm', ['-v'], 'npm'));
checks.push(check('npx', ['-v'], 'npx'));
checks.push(check('git', ['--version'], 'git'));
checks.push(check('docker', ['--version'], 'docker (optional for Strix)'));
checks.push(check('pwsh', ['-v'], 'PowerShell (pwsh) - optional'));
// check playwright test presence
try {
  const pkg = require('../package.json');
  if (pkg.devDependencies && pkg.devDependencies['@playwright/test']) {
    console.log('OK  : @playwright/test present in devDependencies');
  } else {
    console.warn('MISS: @playwright/test not declared in devDependencies');
  }
} catch (e) {
  // ignore
}
const failures = checks.filter(v => !v).length;
if (failures) {
  console.error(`Doctor found ${failures} missing tools. See warnings above.`);
  process.exit(2);
}
console.log('Tooling doctor completed: all required tools appear present (local checks).');
process.exit(0);
