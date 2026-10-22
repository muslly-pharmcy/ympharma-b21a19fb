#!/usr/bin/env node
import { runLocalCli } from './common.js';

if (process.env.CTX7_ALLOW !== '1') {
  console.error('Blocked: set CTX7_ALLOW=1 to permit the Context7 connectivity check.');
  process.exitCode = 2;
} else {
  process.exitCode = runLocalCli('ctx7', 'ctx7', ['library', 'react']);
}
