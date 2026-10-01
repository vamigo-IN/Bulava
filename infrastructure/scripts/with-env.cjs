#!/usr/bin/env node
// Load the repo-root .env (if present) then run a command.
// Usage: node infrastructure/scripts/with-env.cjs <command> [...args]
// Existing environment variables win over .env values.
const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

const envFile = path.resolve(__dirname, '..', '..', '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('with-env: missing command');
  process.exit(1);
}
const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(result.status ?? 1);
