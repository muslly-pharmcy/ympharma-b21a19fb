#!/usr/bin/env node
// strix-help.js
console.log('Strix integration helper');
console.log('This repository includes a gated scanner invocation: scripts/devtools/strix-scan.js');
console.log('To run a safe dry-run/help: node scripts/devtools/strix-help.js');
console.log('To run a scan you MUST set SECURITY_STRIX_DOCKER=1 and add allowed targets to scripts/devtools/strix-allowlist.json');
console.log('Read docs/TOOLING_INTEGRATION.md for guidance and the safe workflow before running any scans.');
