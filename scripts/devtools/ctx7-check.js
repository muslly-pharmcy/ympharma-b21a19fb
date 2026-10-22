#!/usr/bin/env node
// ctx7-check.js
// Attempts a real Context7 resolution for a known library (react) to validate connectivity.
import { spawn } from 'node:child_process';
if (process.argv.includes('--help')) {
  console.log('Set CTX7_ALLOW=1 to run the optional Context7 connectivity check.');
  process.exit(0);
}
if (process.env.CTX7_ALLOW !== '1') {
  console.error('Blocked: set CTX7_ALLOW=1 to permit Context7 connectivity checks. See docs/TOOLING_INTEGRATION.md');
  process.exit(2);
}
console.log('Resolving Context7 library id for react (npx ctx7 library react)');
const proc = spawn('npx', ['ctx7', 'library', 'react'], { stdio: 'inherit', shell: true });
proc.on('close', code => {
  if (code !== 0) process.exit(code);
  console.log('Context7 library resolution completed.');
});
