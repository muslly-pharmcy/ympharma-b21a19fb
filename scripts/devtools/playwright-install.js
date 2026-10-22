#!/usr/bin/env node
import { runLocalCli } from './common.js';

process.exitCode = runLocalCli('@playwright/test', 'playwright', ['install', ...process.argv.slice(2)]);
