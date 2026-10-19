#!/usr/bin/env node
// playwright-smoke.js
// Lightweight smoke runner that attempts to run the Playwright test suite for the chromium project only.
// This script will run `npx playwright test --project=chromium --config=playwright.config.ts --reporter=list`
const { spawn } = require('child_process');
console.log('Playwright smoke: running existing Playwright tests (chromium project)');
const proc = spawn('npx', ['playwright', 'test', '--project=chromium', '--config=playwright.config.ts', '--reporter=list'], { stdio: 'inherit', shell: true });
proc.on('close', code => {
  if (code !== 0) {
    console.error(`Playwright tests exited with code ${code}`);
    process.exit(code);
  }
  console.log('Playwright smoke run completed.');
});
