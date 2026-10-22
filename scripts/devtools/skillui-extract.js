#!/usr/bin/env node
import { artifactDirectory, runLocalCli } from './common.js';

if (process.env.SKILLUI_ALLOW !== '1') {
  console.error('Blocked: set SKILLUI_ALLOW=1 to permit local SkillUI extraction.');
  process.exitCode = 2;
} else {
  try {
    const output = artifactDirectory(process.env.SKILLUI_OUT || 'artifacts/skillui');
    process.exitCode = runLocalCli('skillui', 'skillui', ['dir', '.', '--out', output]);
  } catch (error) {
    console.error('Blocked: ' + error.message);
    process.exitCode = 2;
  }
}
