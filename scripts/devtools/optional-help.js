#!/usr/bin/env node
const tool = process.argv[2];
if (tool === 'ctx7') {
  console.log('Context7: install a reviewed local ctx7 version, then opt in with CTX7_ALLOW=1 and run ctx7:check.');
} else if (tool === 'skillui') {
  console.log('SkillUI: install a reviewed local skillui version, then opt in with SKILLUI_ALLOW=1 and run skillui:extract. Output stays in artifacts/.');
} else {
  process.exitCode = 2;
}
console.log('See docs/TOOLING_INTEGRATION.md. This help command does not install tools or contact a service.');
