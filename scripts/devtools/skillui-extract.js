#!/usr/bin/env node
// skillui-extract.js
// Wrapper for npx skillui directory extraction. This script enforces opt-in and safe output path.
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const OUT = process.env.SKILLUI_OUT || path.join(process.cwd(), 'artifacts', 'skillui');
if (process.env.SKILLUI_ALLOW !== '1') {
  console.error('Blocked: set SKILLUI_ALLOW=1 to permit local SkillUI extraction. See docs/TOOLING_INTEGRATION.md');
  process.exit(2);
}
fs.mkdirSync(OUT, { recursive: true });
console.log(`Running: npx skillui dir . --out ${OUT}`);
const proc = spawn('npx', ['skillui', 'dir', '.', '--out', OUT], { stdio: 'inherit', shell: true });
proc.on('close', code => {
  if (code !== 0) process.exit(code);
  console.log(`SkillUI extraction completed. Output: ${OUT}`);
});
