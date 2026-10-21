#!/usr/bin/env node
import { runLocalCli } from './common.js';

// Uses E2E_BASE_URL from the existing config. Point it at an isolated test server.
process.exitCode = runLocalCli('@playwright/test', 'playwright', ['test', '--project=chromium', '--config=playwright.config.ts', '--reporter=list']);
