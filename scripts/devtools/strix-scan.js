#!/usr/bin/env node
// strix-scan.js
// Gated, safe Strix scan runner. Requires SECURITY_STRIX_DOCKER=1 and that SCAN_TARGET exists in allowlist.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const ALLOW = path.join(__dirname, 'strix-allowlist.json');
if (process.env.SECURITY_STRIX_DOCKER !== '1') {
  console.error('Blocked: to run Strix you must set SECURITY_STRIX_DOCKER=1. Aborting.');
  process.exit(2);
}
if (!process.env.SCAN_TARGET) {
  console.error('Blocked: set SCAN_TARGET to an allowed local directory (e.g. \'./staging-scan\')');
  process.exit(2);
}
let allowlist = [];
try { allowlist = JSON.parse(fs.readFileSync(ALLOW, 'utf8')); } catch (e) { console.error('Allowlist parse error or missing. Create scripts/devtools/strix-allowlist.json with approved targets.'); process.exit(2); }
const target = process.env.SCAN_TARGET;
if (!allowlist.includes(target)) {
  console.error(`Blocked: SCAN_TARGET '${target}' is not in allowlist. Add it to ${ALLOW} to proceed.`);
  process.exit(2);
}
// Use a pinned image tag (not :latest). Edit as needed after review.
const IMAGE = process.env.STRIX_IMAGE || 'ghcr.io/usestrix/strix-sandbox:1.3.0';
console.log(`Running Strix in Docker (image=${IMAGE}) against target=${target}`);
const cmd = `docker run --rm -v "${process.cwd()}":/work -w /work ${IMAGE} strix --target ${target} --reporter json --output /work/artifacts/strix-report.json`;
console.log('Command:', cmd);
const proc = spawn(cmd, { stdio: 'inherit', shell: true });
proc.on('close', code => {
  if (code !== 0) {
    console.error(`Strix runner exited with code ${code}`);
    process.exit(code);
  }
  console.log('Strix run completed. Report written to ./artifacts/strix-report.json (sanitize before sharing).');
});
