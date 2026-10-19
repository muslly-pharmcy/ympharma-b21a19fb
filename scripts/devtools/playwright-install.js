#!/usr/bin/env node
// playwright-install.js
// Installs Playwright browsers in a cross-platform way by invoking the official installer.
const { spawn } = require('child_process');
console.log('Running Playwright installer (npx playwright install --with-deps)');
const proc = spawn('npx', ['playwright', 'install', '--with-deps'], { stdio: 'inherit', shell: true });
proc.on('close', code => {
  if (code !== 0) {
    console.error(`Playwright installer exited with code ${code}`);
    process.exit(code);
  }
  console.log('Playwright browsers installed.');
});
